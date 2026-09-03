import React, { useState, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { motion } from 'motion/react';
import { EstimationHeader } from './EstimationHeader';
import { EstimationTable } from './EstimationTable';
import { RATE_PER_HOUR, CONTRACTED_EMPLOYEE_RATE, HOURS_PER_MONTH, ALL_FISCAL_YEARS, DEFAULT_FY, SKILL_MAPPING, EXPENSE_MAPPING, EXPENSE_CATEGORIES, SKILL_ORDER, MAX_MONTHS, isConfirmedProject, normalizeSkill, isSummaryOrCalculatedLabel } from '../constants';
import { 
  ProjectData, 
  FiscalYear,
  MasterConfigState,
  FiscalMode,
  MANPOWER_CATEGORIES,
  Employee,
  TaskInfo,
  getAbsoluteMonthIndex,
  MasterProject
} from '../types';
import { PortfolioIntelligenceBar } from './Dashboard';
import { FilterBar } from './Filters';
import { ImportInspectionModal } from './ImportInspectionModal';
import PMOAnalyticsView from './PMOAnalyticsView';
import ProjectTeamView from './ProjectTeamView';
import ResourceAllocationTab from './ResourceAllocationTab';
import EmployeeRoster from './EmployeeRoster';
import EmployeeAnalysis from './EmployeeAnalysis';
import { ExpenseList, clubExpenseDetail } from './ExpenseList';
import { processExcelImport, exportProjectRegistry } from '../services/exportService';
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

export const getAuthoritativeRowUI = (
  p: ProjectData,
  cat: string,
  sourceKey: 'pmoRows' | 'actuals' | 'forecast'
): number[] => {
  const findInObj = (obj: any, key: string) => {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const keys = Object.keys(obj);
    const matchedKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
    return matchedKey ? obj[matchedKey] : undefined;
  };

  const checkArray = (data: any) => {
    const arr = ensureArray(data, MAX_MONTHS);
    return arr.some(v => v !== 0) ? arr : null;
  };

  // 1. Check primary source (case-insensitive)
  let res = checkArray(findInObj(p[sourceKey], cat));
  if (res) return res;

  // 2. Check mode-specific skills (actualsSkills/forecastSkills)
  if (sourceKey === 'actuals') {
     res = checkArray(findInObj((p as any).actualsSkills, cat));
     if (res) return res;
  } else if (sourceKey === 'forecast') {
     res = checkArray(findInObj((p as any).forecastSkills, cat));
     if (res) return res;
  }

  // 3. Check EmployeeSkills fallbacks
  const empSkillsKey = sourceKey === 'actuals' ? 'actualsEmployeeSkills' : (sourceKey === 'forecast' ? 'forecastEmployeeSkills' : 'employeeSkills');
  const targetEmployeeSkills = p[empSkillsKey] as any;
  if (targetEmployeeSkills) {
    const allocsObj = findInObj(targetEmployeeSkills, cat);
    if (allocsObj) {
      const sumRow = Array(MAX_MONTHS).fill(0);
      Object.values(allocsObj).forEach((allocs: any) => {
        if (Array.isArray(allocs)) {
          allocs.forEach((val, i) => {
            if (i < MAX_MONTHS) sumRow[i] += (val || 0);
          });
        }
      });
      if (sumRow.some(v => v !== 0)) return sumRow;
    }
  }

  // 4. Do NOT fall back to pmoRows for actuals or forecast to preserve data isolation between Budget, Actuals, and Forecast.
  return Array(MAX_MONTHS).fill(0);
};

const processRawData = (
  rawData: any[],
  selectedFYs: FiscalYear | FiscalYear[],
  masterConfig: MasterConfigState,
  mode: string,
  existingProjects: ProjectData[],
  employees?: Employee[]
) => {
  const currentSelectedFY = Array.isArray(selectedFYs) ? selectedFYs[0] : (selectedFYs as FiscalYear);
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return { results: [], metadata: { processedCount: 0, dateErrorCount: 0, fyMismatchCount: 0, totalRows: 0 } };

  const projectMap: Record<string, {
    code: string;
    name: string;
    actualSpent: number;
    manpowerSpent: number;
    expenseSpent: number;
    monthlyFTEs: number[];
    monthlyActuals: number[];
    skills: Record<string, number[]>;
    expenses: Record<string, number[]>;
    igGates: string[];
    vertical?: string;
    category?: string;
    productFamily?: string;
    generation?: string;
    employeeSkills: Record<string, Record<string, number[]>>;
    employeeBillableHours: Record<string, number[]>;
    employeeNonBillableHours: Record<string, number[]>;
    employeeIdleHours: Record<string, number[]>;
    employeeInfo: Record<string, { name: string, email: string, skill?: string, skillLevel2?: string, category?: string }>;
    expenseDetails?: Record<string, Record<string, number[]>>;
    projectTasks: Record<string, TaskInfo[]>;
    employeeTasks: Record<string, Record<string, TaskInfo[]>>;
    seenMonths: Set<number>;
  }> = {};

  const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
  const isAllFY = fyStrings.includes('All FY');
  const primaryFY = fyStrings[0] || DEFAULT_FY;
  const fyConfig = masterConfig.fyFinancials?.[primaryFY] || Object.values(masterConfig.fyFinancials || {})[0];
  const fyFinancials = { 
    hourlyRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR), 
    hoursPerMonth: 180,
    contractedEmployeeRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
  };
  const hourlyRate = fyFinancials.hourlyRate;
  const contractedRate = fyFinancials.contractedEmployeeRate;
  const hpm = fyFinancials.hoursPerMonth;

  let yearOffset = 0;
  let yearLimit = MAX_MONTHS;

  const validMonthIndices = new Set<number>();
  if (isAllFY) {
      for(let i=0; i<MAX_MONTHS; i++) validMonthIndices.add(i);
  } else {
      fyStrings.forEach(fy => {
          const parts = fy.replace('FY ', '').split('-');
          const startYear = parseInt(parts[0]);
          const offset = (startYear - 19) * 12; // April start
          for(let i = offset; i < offset + 12; i++) {
              validMonthIndices.add(i);
          }
      });
  }

  // Dynamic Column Detection
  let colIndices: any = {
    code: -1,
    codePriority: 0,
    codeIndices: [],
    name: -1,
    month: -1,
    monthPriority: 0,
    year: -1,
    hours: -1,
    amount: -1,
    amountPriority: 0,
    amountFound: false,
    bucket: -1,
    type: -1,
    skill: -1,
    skillFound: false,
    user: -1,
    userEmail: -1,
    billableCheck: -1,
    task: -1,
    taskList: -1,
    percentage: -1,
    vertical: -1,
    creatType: -1,
    productFamily: -1,
    generation: -1,
    employeeType: -1,
    expenseDetail: -1
  };

      // Find header row and map columns
      const headerRowIdx = rawData.findIndex(row => 
        Array.isArray(row) && row.some(cell => {
          const s = String(cell).toLowerCase();
          return s.includes('project code') || s.includes('project name') || s.includes('record type') || s.includes('role hr master 2') || s.includes('functional unit') || s === 'month' || s === 'hours' || s === 'amount' || s.includes('user') || s.includes('mailid') || s.includes('email') || s.includes('mail id') || s === 'year' || s === 'fy' || s.includes('job name') || s.includes('task name') || s.includes('activity');
        })
      );

      if (headerRowIdx !== -1) {
        const headerRow = rawData[headerRowIdx];
        headerRow.forEach((cell: any, idx: number) => {
          const s = String(cell).toLowerCase().trim();
          if (s.includes('project code') || s === 'code' || s === 'project_code' || s === 'project' || s === 'project_id' || s === 'id' || s === 'external_id' || s === 'external_id_1' || s.includes('project_id') || s.includes('project id') || s === 'pcode' || s.includes('project id') || s === 'job name' || s === 'job_name' || s.includes('job id') || s.includes('job code')) {
             // Priority: 1. "project code", 2. "code", 3. "project_id", 4. "project", 5. "id"
             let priority = 0;
             if (s.includes('project code') || s === 'project_code') priority = 6;
             else if (s === 'code' || s === 'pcode') priority = 5;
             else if (s === 'project_id' || s === 'projectid' || s.includes('project id') || s.includes('job id') || s.includes('job code')) priority = 4;
             else if (s === 'project' || s === 'job name' || s === 'job_name') priority = 3;
             else if (s === 'id' || s.includes('external id') || s === 'external_id' || s === 'external_id_1') priority = 2;
             else if (s.includes('project') || s.includes('job')) priority = 1;

             if (priority > 0) {
               colIndices.codeIndices.push({ idx, priority });
               colIndices.codeIndices.sort((a: any, b: any) => b.priority - a.priority);
             }

             if (priority > (colIndices.codePriority || 0)) {
               colIndices.code = idx;
               colIndices.codePriority = priority;
             }
          }
          if (s.includes('project name') || s === 'name' || s === 'project_name' || s === 'job name') {
            if (colIndices.name === -1 || s.includes('project name')) colIndices.name = idx;
          }
      
      // Prioritize 'month' column over 'date' column as requested by user
      if (s === 'month' || s === 'month-year' || s === 'month year' || s === 'reporting month') {
        colIndices.month = idx;
        colIndices.monthPriority = 2;
      } else if ((s === 'date' || s === 'period' || s === 'month' || s.includes('date')) && colIndices.monthPriority < 2) {
        colIndices.month = idx;
        colIndices.monthPriority = 1;
      }

      if (s === 'year' || s === 'fiscal year' || s === 'fy') colIndices.year = idx;
      
      // Separate hours and amount detection
      // Be more specific for hours to avoid picking up amount columns
      if (s === 'hours' || s === 'working hours' || s === 'billable hours' || s === 'hrs') {
        colIndices.hours = idx;
      } else if ((s === 'quantity' || s === 'qty' || s === 'units') && colIndices.hours === -1) {
        colIndices.hours = idx;
      }
      
      // Amount detection: Prioritize 'total expense' as requested for expenses
      if (s === 'amount' || s === 'value' || s === 'cost' || s === 'total' || s.includes('expense amount') || s.includes('total expense') || s.includes('total expen') || s === 'actuals' || s.includes('total cost') || s.includes('net cost') || s.includes('manpower cost') || s.includes('expense_amount')) {
         // Priority: 1. "total expense", 2. "expense amount", 3. "total cost", 4. "amount"
         let priority = 1;
         if (s.includes('total expense') || s.includes('total expen')) priority = 6;
         else if (s.includes('expense amount') || s.includes('expense_amount')) priority = 5;
         else if (s.includes('total cost') || s.includes('net cost')) priority = 4;
         else if (s === 'amount') priority = 3;
         else if (s === 'total' || s === 'value' || s === 'cost' || s === 'actuals' || s.includes('manpower cost')) priority = 2;

         if (priority > (colIndices.amountPriority || 0)) {
           colIndices.amount = idx;
           colIndices.amountPriority = priority;
           colIndices.amountFound = true;
         }
      }
      
      if (s.includes('expense bucket') || s === 'bucket' || s === 'category' || s.includes('exp bucket') || s.includes('expense category')) colIndices.bucket = idx;
      if (s.includes('record type') || s === 'type' || s === 'record_type' || s === 'recordtype') colIndices.type = idx;
      if (s.includes('role hr master 2')) {
        colIndices.skill = idx;
        colIndices.skillFound = true;
      } else if (!colIndices.skillFound && (s === 'skill' || s.includes('functional unit') || s === 'label' || s === 'role' || s === 'designation')) {
        colIndices.skill = idx;
      }
      if (s === 'vertical') colIndices.vertical = idx;
      if (s === 'creat type' || s === 'creat_type' || s === 'type') colIndices.creatType = idx;
      if (s.includes('product family') || s.includes('product_family') || s.includes('family')) colIndices.productFamily = idx;
      if (
        s === 'user' ||
        s === 'resource name' ||
        s === 'employee name' ||
        s === 'employee' ||
        s === 'resource' ||
        s.includes('resource name') ||
        s.includes('employee name') ||
        (s.includes('user') && !s.includes('mailid') && !s.includes('email'))
      ) {
        colIndices.user = idx;
      }
      if (
        s.includes('mailid') ||
        s === 'email' ||
        s.includes('email') ||
        s === 'mail' ||
        s.includes('mail id') ||
        s.includes('mail_id')
      ) {
        colIndices.userEmail = idx;
      }
      if (s.includes('billable check')) colIndices.billableCheck = idx;
      if (s === 'task' || s === 'task name' || s === 'task_name' || s === 'activity' || s === 'activity name' || s === 'task_description' || s === 'description') {
        if (colIndices.task === -1 || s === 'task' || s === 'task name') colIndices.task = idx;
      }
      if (s === 'task list' || s === 'task_list' || s === 'tasklist' || s === 'activity list' || s === 'activity_list' || s === 'task_group') {
        if (colIndices.taskList === -1 || s === 'task list') colIndices.taskList = idx;
      }
      if (s.includes('percentage') || s === '%' || s === 'utilization' || s === 'allocation') colIndices.percentage = idx;
      if (s.includes('employee type') || s === 'employee_type') colIndices.employeeType = idx;
      if (s === 'generation') colIndices.generation = idx;
      if (s.includes('expense detail') || s === 'expense_detail' || s.includes('expense description') || s === 'detail' || s === 'expense_item') {
        colIndices.expenseDetail = idx;
      }
    });
  }

  // Fallbacks if columns not found
    if (colIndices.month === -1) colIndices.month = 6;
    if (colIndices.year === -1) colIndices.year = -1;
    if (colIndices.hours === -1) colIndices.hours = 11;
    if (colIndices.amount === -1) colIndices.amount = 25;
    if (colIndices.bucket === -1) colIndices.bucket = 21;
    if (colIndices.type === -1) colIndices.type = 22;
    if (colIndices.skill === -1) colIndices.skill = 32;
    if (colIndices.vertical === -1) colIndices.vertical = 16;
    if (colIndices.creatType === -1) colIndices.creatType = 15;
    if (colIndices.productFamily === -1) colIndices.productFamily = 14;
    if (colIndices.user === -1) colIndices.user = 2;
    if (colIndices.userEmail === -1) colIndices.userEmail = 3;
    if (colIndices.billableCheck === -1) colIndices.billableCheck = 13;
    if (colIndices.task === -1) colIndices.task = 9;
    if (colIndices.taskList === -1) colIndices.taskList = 10;
    if (colIndices.employeeType === -1) colIndices.employeeType = 30;
    if (colIndices.expenseDetail === -1) colIndices.expenseDetail = 20;

    console.log("Detected Column Indices:", colIndices);
    if (headerRowIdx !== -1) console.log("Header Row:", rawData[headerRowIdx]);

  let processedCount = 0;
  let dateErrorCount = 0;
  let fyMismatchCount = 0;

  const seenMonths = new Set<number>();
  const ratesCache: Record<number, { hRate: number, cRate: number }> = {};

    rawData.forEach((row, rowIndex) => {
      if (rowIndex <= headerRowIdx) return; // Skip header and anything above it
      if (!row || !Array.isArray(row) || row.length < 2) return;

      let projectCode = '';
      if (colIndices.codeIndices && colIndices.codeIndices.length > 0) {
        for (const ci of colIndices.codeIndices) {
          const val = String(row[ci.idx] || '').trim().toUpperCase();
          if (val && val !== 'PROJECT CODE' && val !== 'CODE' && val !== 'ID' && !val.includes('TIMESHEET') && !val.includes('ZOHO') && val !== 'SYSTEM-ID' && val !== 'JOB NAME') {
            projectCode = val;
            break;
          }
        }
      } else {
        projectCode = String(row[colIndices.code] || '').trim().toUpperCase();
      }

      // If projectCode is a 4-8 digit numeric entry ID (e.g., 218933) and Column B (name) contains project code pattern like UMD-4322:
      const rawNameForCode = String(row[colIndices.name] || '').trim();
      if (/^\d{4,8}$/.test(projectCode) && /(UMD-\d+|PRJ-\d+|[A-Z]{2,}-\d+)/i.test(rawNameForCode)) {
        const codeMatch = rawNameForCode.match(/(UMD-\d+|PRJ-\d+|[A-Z]{2,}-\d+)/i);
        if (codeMatch) {
          projectCode = codeMatch[0].toUpperCase();
        }
      }

      if (!projectCode || projectCode === 'PROJECT CODE' || projectCode.includes('TIMESHEET') || projectCode.includes('ZOHO') || projectCode === 'CODE' || projectCode === 'ID' || projectCode === 'SYSTEM-ID') {
        if (rowIndex < headerRowIdx + 20) console.log(`Skipping row ${rowIndex}: No valid project code found. CodeIndices=${JSON.stringify(colIndices.codeIndices)}, Val=${row[colIndices.code]}`);
        return;
      }
      
      const projectName = String(row[colIndices.name] || '').trim();
      const isHolidayLeave = projectName.toLowerCase().includes('holiday') || projectName.toLowerCase().includes('leave');
      
      let dateVal = row[colIndices.month];
      const yearVal = colIndices.year !== -1 ? row[colIndices.year] : null;
      
      if (dateVal === undefined || dateVal === null || dateVal === '') {
        if (rowIndex < headerRowIdx + 20) console.log(`Skipping row ${rowIndex}: Date value is empty.`);
        return;
      }
      
      // Log first few rows to help debug (limited)
      if (processedCount < 3) console.log("Parsing row:", rowIndex, "dateVal:", dateVal, "Type:", typeof dateVal, "Project:", projectCode);
      
      // Help parseMonth with year info if it's in a separate column or needs concatenation
      if (yearVal && typeof dateVal === 'string' && !dateVal.includes('-') && !dateVal.includes('20')) {
         dateVal = `${dateVal}-${yearVal}`;
      }

      let date: Date | null = null;
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

      if (dateVal instanceof Date) {
        date = dateVal;
      } else if (typeof dateVal === 'number') {
        if (dateVal > 40000 && dateVal < 60000) {
          // Excel serial date (UTC based)
          date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        } else if (dateVal >= 1 && dateVal <= 12) {
          // Just a month number, use current year or default
          const y = yearVal ? parseInt(String(yearVal)) : (new Date().getFullYear());
          date = new Date(Date.UTC(y, dateVal - 1, 1));
        }
      } else {
        const dateStr = String(dateVal).trim();
        if (!dateStr) return;

        // Try manual parsing for MMM-YY, MMM-YYYY, MM-YYYY, or YYYY-MM
        // Also handle DD-MMM-YYYY common in Zoho
        const parts = dateStr.toLowerCase().split(/[-/\s.]/).filter(p => p.length > 0);
        
        if (parts.length >= 2) {
          let m = -1;
          let y = -1;
          let d = 1;

          // Check for named month
          for (let i = 0; i < parts.length; i++) {
            const foundMonth = monthNames.findIndex(name => parts[i].startsWith(name));
            if (foundMonth !== -1) {
              m = foundMonth;
              if (parts.length === 3) {
                // Likely DD-MMM-YYYY or YYYY-MMM-DD
                if (i === 1) { // Middle is month: DD-MMM-YYYY
                  d = parseInt(parts[0]);
                  y = parseInt(parts[2]);
                } else if (i === 0) { // First is month: MMM-DD-YYYY
                  d = parseInt(parts[1]);
                  y = parseInt(parts[2]);
                }
              } else {
                // Likely MMM-YYYY or MMM-YY
                const otherIdx = i === 0 ? 1 : 0;
                y = parseInt(parts[otherIdx]);
              }
              break;
            }
          }

          // If no named month, try numeric
          if (m === -1 && parts.length >= 2) {
            const p0 = parseInt(parts[0]);
            const p1 = parseInt(parts[1]);
            const p2 = parts.length >= 3 ? parseInt(parts[2]) : NaN;
            
            if (parts.length === 3) {
              if (p2 > 100) { y = p2; m = p1 - 1; d = p0; } // DD-MM-YYYY
              else if (p0 > 100) { y = p0; m = p1 - 1; d = p2; } // YYYY-MM-DD
            } else {
              if (p0 <= 12 && p1 > 100) { m = p0 - 1; y = p1; } // MM-YYYY
              else if (p0 > 100 && p1 <= 12) { y = p0; m = p1 - 1; } // YYYY-MM
            }
          }

          if (m !== -1 && !isNaN(y)) {
            if (y < 100) y += 2000;
            date = new Date(Date.UTC(y, m, isNaN(d) ? 1 : d));
          }
        }

        if (!date || isNaN(date.getTime())) {
          // Fallback for native Date parsing
          date = new Date(dateStr);
        }
      }

      if (!date || isNaN(date.getTime())) {
        if (rowIndex < headerRowIdx + 20) console.log(`Skipping row ${rowIndex}: Invalid date format. dateVal=${dateVal}`);
        dateErrorCount++;
        return;
      }

    // CRITICAL: Use UTC methods to avoid timezone-related month shifts
    const utcDate = new Date(date.getTime() + 43200000);
    const month = utcDate.getUTCMonth();
    const year = utcDate.getUTCFullYear();
    
    // Global Month Index calculation (April 2019 is index 0)
    const monthIdx = (year - 2019) * 12 + month - 3;
    
    if (monthIdx < 0 || monthIdx >= MAX_MONTHS) {
      fyMismatchCount++;
      return;
    }

    const fyIdx = Math.floor(monthIdx / 12);
    const fyStartYear = 19 + fyIdx;
    const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
    
    if (!isAllFY && !fyStrings.includes(fyStr as any)) {
      fyMismatchCount++;
      return;
    }

    processedCount++;
    seenMonths.add(monthIdx);

    if (!projectMap[projectCode]) {
      projectMap[projectCode] = {
        code: projectCode,
        name: projectName,
        actualSpent: 0,
        manpowerSpent: 0,
        expenseSpent: 0,
        monthlyFTEs: new Array(MAX_MONTHS).fill(0),
        monthlyActuals: new Array(MAX_MONTHS).fill(0),
        skills: {},
        expenses: {},
        igGates: [],
        vertical: String(row[colIndices.vertical] || '').trim(),
        category: String(row[colIndices.creatType] || '').trim(),
        productFamily: String(row[colIndices.productFamily] || '').trim(),
        generation: colIndices.generation !== -1 ? String(row[colIndices.generation] || '').trim() : 'Current',
        employeeSkills: {},
        employeeBillableHours: {},
        employeeNonBillableHours: {},
        employeeIdleHours: {},
        employeeInfo: {},
        expenseDetails: {},
        projectTasks: {},
        employeeTasks: {},
        seenMonths: new Set<number>()
      };
    }

    const p = projectMap[projectCode];
    p.seenMonths.add(monthIdx);
    
    const expBucketRaw = String(row[colIndices.bucket] || '').trim();
    const recordType = String(row[colIndices.type] || '').trim().toLowerCase();
    const rawSkill = String(row[colIndices.skill] || '').trim();
    const employeeType = String(row[colIndices.employeeType] || '').trim();
    
    const hoursVal = row[colIndices.hours];
    const amountVal = row[colIndices.amount];
    
    const parseVal = (val: any) => {
      if (typeof val === 'number') return val;
      if (val === undefined || val === null) return 0;
      // Handle the currency symbols and commas correctly
      const clean = String(val).replace(/[^0-9.%eE-]/g, '');
      if (clean.includes('%')) return (parseFloat(clean.replace('%', '')) || 0) / 100;
      return parseFloat(clean || '0') || 0;
    };

    const hours = parseVal(hoursVal);
    const amount = parseVal(amountVal);
    
    // Determine the fiscal year of this data point
    const fyIdxIdx = Math.floor(monthIdx / 12);
    const fyStartYearIdx = 19 + fyIdxIdx;
    const currentDataFyStr = `FY ${fyStartYearIdx}-${fyStartYearIdx + 1}`;
    const isSelectedMonth = isAllFY || fyStrings.includes(currentDataFyStr as any);

    // Rates cache for current month
    if (!ratesCache[monthIdx]) {
      const fyCfg = masterConfig.fyFinancials?.[currentDataFyStr];
      ratesCache[monthIdx] = {
        hRate: (fyCfg?.hourlyRate !== undefined && fyCfg?.hourlyRate !== null) ? fyCfg.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
        cRate: (fyCfg?.contractedEmployeeRate !== undefined && fyCfg?.contractedEmployeeRate !== null) ? fyCfg.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
    }
    const { hRate, cRate } = ratesCache[monthIdx];

    const user = String(row[colIndices.user] || '').trim();
    const userEmail = String(row[colIndices.userEmail] || '').trim().toLowerCase();
    const billableCheck = String(row[colIndices.billableCheck] || '').trim().toLowerCase();
    const taskName = String(row[colIndices.task] || '').trim();
    const taskList = String(row[colIndices.taskList] || '').trim();
    const taskHours = parseVal(row[colIndices.hours]);
    const taskPct = colIndices.percentage !== -1 ? parseVal(row[colIndices.percentage]) : (taskHours / (hpm || 180));
    const taskDesc = taskName.toLowerCase();

    // Group tasks by task list
    if (taskList && taskName) {
      if (!p.projectTasks[taskList]) p.projectTasks[taskList] = [];
      const existingTask = p.projectTasks[taskList].find(t => t.name === taskName);
      if (!existingTask) {
        const monthlyAllocations = new Array(MAX_MONTHS).fill(0);
        const monthlyHours = new Array(MAX_MONTHS).fill(0);
        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
          monthlyAllocations[monthIdx] = taskPct;
          monthlyHours[monthIdx] = taskHours;
        }
        p.projectTasks[taskList].push({ name: taskName, percentage: taskPct, hours: taskHours, monthlyAllocations, monthlyHours });
      } else {
        existingTask.percentage += taskPct;
        existingTask.hours += taskHours;
        if (!existingTask.monthlyAllocations) existingTask.monthlyAllocations = new Array(MAX_MONTHS).fill(0);
        if (!existingTask.monthlyHours) existingTask.monthlyHours = new Array(MAX_MONTHS).fill(0);
        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
          existingTask.monthlyAllocations[monthIdx] += taskPct;
          existingTask.monthlyHours[monthIdx] += taskHours;
        }
      }

      // Group tasks by employee and task list
      if (userEmail) {
        if (!p.employeeTasks[userEmail]) p.employeeTasks[userEmail] = {};
        if (!p.employeeTasks[userEmail][taskList]) p.employeeTasks[userEmail][taskList] = [];
        const existingEmpTask = p.employeeTasks[userEmail][taskList].find(t => t.name === taskName);
        if (!existingEmpTask) {
          const monthlyAllocations = new Array(MAX_MONTHS).fill(0);
          const monthlyHours = new Array(MAX_MONTHS).fill(0);
          if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
            monthlyAllocations[monthIdx] = taskPct;
            monthlyHours[monthIdx] = taskHours;
          }
          p.employeeTasks[userEmail][taskList].push({ name: taskName, percentage: taskPct, hours: taskHours, monthlyAllocations, monthlyHours });
        } else {
          existingEmpTask.percentage += taskPct;
          existingEmpTask.hours += taskHours;
          if (!existingEmpTask.monthlyAllocations) existingEmpTask.monthlyAllocations = new Array(MAX_MONTHS).fill(0);
          if (!existingEmpTask.monthlyHours) existingEmpTask.monthlyHours = new Array(MAX_MONTHS).fill(0);
          if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
            existingEmpTask.monthlyAllocations[monthIdx] += taskPct;
            existingEmpTask.monthlyHours[monthIdx] += taskHours;
          }
        }
      }
    }

    // STRICT LOGIC AS PER USER REQUEST:
    // Record Type (Column W) == Timelog -> Skill (using Hours from Column L)
    // Record Type (Column W) == Expense -> Expense (using Amount from Column X/Z)
    
    const isExpense = recordType === 'expense' || 
                      recordType.includes('expense') || 
                      recordType.includes('opex') ||
                      (!recordType.includes('timelog') && (
                        (amount !== 0 && hours === 0) || 
                        (expBucketRaw !== '' && amount !== 0)
                      ));
    const isTimelog = (recordType === 'timelog' || recordType.includes('timelog') || recordType.includes('time log')) || 
                      (!isExpense && hours > 0);
    const isConsultant = employeeType.toLowerCase().includes('consultant');

    // Roster & Skill Tracking (for all timelogs)
    if (isTimelog) {
      let derivedSkill = '';
      if (employees && employees.length > 0 && (userEmail || user)) {
        const emp = employees.find(e => 
          (userEmail && ((e.email || '').trim().toLowerCase() === userEmail.toLowerCase() || (e.id || '').trim().toLowerCase() === userEmail.toLowerCase())) ||
          (user && (e.name || '').trim().toLowerCase() === user.toLowerCase())
        );
        if (emp) {
          if (emp.skill && emp.skill !== 'Unspecified Skill' && emp.skill !== 'NA') {
            derivedSkill = emp.skill;
          } else if (emp.skillLevel2 && emp.skillLevel2 !== 'Unspecified Skill' && emp.skillLevel2 !== 'NA') {
            derivedSkill = emp.skillLevel2;
          }
        }
      }
      
      const skillName = (derivedSkill && derivedSkill !== 'Unspecified Skill' && derivedSkill !== 'NA') ? derivedSkill : (rawSkill || '');
      let skill = isConsultant ? 'Contracted Employee' : normalizeSkill(skillName);

      const mm = hours / (hpm || 180);
      
      if (!p.skills[skill]) p.skills[skill] = new Array(MAX_MONTHS).fill(0);
      p.skills[skill][monthIdx] += mm;
      p.monthlyFTEs[monthIdx] += mm;

      // Calculate cost (Convert to Crores)
      const cost = (isConsultant ? (mm * cRate * hpm) : (isHolidayLeave ? 0 : (mm * hRate * hpm))) / 10000000;
      p.monthlyActuals[monthIdx] += cost;
      
      if (isSelectedMonth) {
        p.actualSpent += cost;
        p.manpowerSpent += cost;
      }

      if (userEmail) {
        const emailLower = userEmail.toLowerCase();
        if (!p.employeeSkills[skill]) p.employeeSkills[skill] = {};
        if (!p.employeeSkills[skill][emailLower]) p.employeeSkills[skill][emailLower] = new Array(MAX_MONTHS).fill(0);
        p.employeeSkills[skill][emailLower][monthIdx] += mm;
        
        if (!p.employeeBillableHours[emailLower]) p.employeeBillableHours[emailLower] = new Array(MAX_MONTHS).fill(0);
        if (!p.employeeNonBillableHours[emailLower]) p.employeeNonBillableHours[emailLower] = new Array(MAX_MONTHS).fill(0);
        if (!p.employeeIdleHours[emailLower]) p.employeeIdleHours[emailLower] = new Array(MAX_MONTHS).fill(0);

        if (billableCheck === 'yes' || billableCheck === 'true' || billableCheck === 'billable' || billableCheck === 'y') {
          p.employeeBillableHours[emailLower][monthIdx] += hours;
        } else {
          p.employeeNonBillableHours[emailLower][monthIdx] += hours;
        }

        if (taskDesc.includes('idle')) {
          p.employeeIdleHours[emailLower][monthIdx] += hours;
        }

        if (!p.employeeInfo[emailLower]) {
          p.employeeInfo[emailLower] = { 
            name: user, 
            email: emailLower,
            skill: skill,
            skillLevel2: rawSkill,
            category: isConsultant ? 'Contracted Employee' : 'Direct Employee'
          };
        } else {
          if (!p.employeeInfo[emailLower].skill || p.employeeInfo[emailLower].skill === 'Unspecified Skill') {
            p.employeeInfo[emailLower].skill = skill;
            p.employeeInfo[emailLower].skillLevel2 = rawSkill;
          }
          if (!p.employeeInfo[emailLower].category || isConsultant) {
            p.employeeInfo[emailLower].category = isConsultant ? 'Contracted Employee' : (p.employeeInfo[emailLower].category || 'Direct Employee');
          }
        }
      }
    } else if (isExpense) {
      let bucket = 'Others';
      const cost = amount / 10000000; // Convert to Crores (preserve sign for negative values)
      const expDetailRaw = colIndices.expenseDetail !== -1 ? String(row[colIndices.expenseDetail] || '').trim() : '';
      const bucketSource = (expBucketRaw || expDetailRaw || rawSkill || projectName || 'Others').trim();
      const normalizedSource = bucketSource.toLowerCase();
      
      if (normalizedSource.includes('travel')) bucket = 'Travel';
      else if (normalizedSource.includes('material')) bucket = 'Material';
      else if (normalizedSource.includes('outsourcing') || normalizedSource.includes('consultant')) bucket = 'Consultant';
      else if (normalizedSource.includes('hr') || normalizedSource.includes('recruit') || normalizedSource.includes('train')) bucket = 'HR';
      else if (normalizedSource.includes('admin')) bucket = 'Admin';
      else if (normalizedSource.includes('lab')) bucket = 'Labs';
      else if (normalizedSource.includes('license') || normalizedSource.includes('liscence') || normalizedSource.includes('licence')) bucket = 'License';
      else if (normalizedSource.includes('other exp') || normalizedSource.includes('miscellaneous') || normalizedSource.includes('other expense')) bucket = 'Others';
      else {
        // Case-insensitive matching against EXPENSE_CATEGORIES
        const matchedCategory = EXPENSE_CATEGORIES.find(c => c.toLowerCase() === normalizedSource);
        if (matchedCategory) {
          bucket = matchedCategory;
        } else {
          bucket = EXPENSE_MAPPING[bucketSource] || bucketSource || 'Others';
          // Final check: if it's "Consultant", ensure it's exactly "Consultant"
          if (bucket.toLowerCase().trim() === 'consultant') bucket = 'Consultant';
        }
      }

      if (processedCount < 20) console.log(`Processing Expense row ${rowIndex}: Bucket=${bucket}, Amount=${cost}, MonthIdx=${monthIdx}`);

      const detailName = clubExpenseDetail(expDetailRaw, projectCode, bucket);
      const targetCat = (bucket === 'Contracted Employee') ? 'Contracted Employee Expense' : bucket;

      if (!p.expenseDetails) p.expenseDetails = {};
      if (!p.expenseDetails[targetCat]) p.expenseDetails[targetCat] = {};
      if (!p.expenseDetails[targetCat][detailName]) p.expenseDetails[targetCat][detailName] = new Array(MAX_MONTHS).fill(0);
      p.expenseDetails[targetCat][detailName][monthIdx] += cost;

      if (bucket === 'Contracted Employee') {
        if (!p.expenses['Contracted Employee Expense']) p.expenses['Contracted Employee Expense'] = new Array(MAX_MONTHS).fill(0);
        p.expenses['Contracted Employee Expense'][monthIdx] += cost;
      } else {
        if (!p.expenses[bucket]) p.expenses[bucket] = new Array(MAX_MONTHS).fill(0);
        p.expenses[bucket][monthIdx] += cost;
      }
      
      p.monthlyActuals[monthIdx] += cost;
      p.actualSpent += cost;
      if (bucket === 'Contracted Employee' || bucket === 'Contracted Employee Expense') {
        p.manpowerSpent += cost;
      } else {
        p.expenseSpent += cost;
      }
    }
 else {
      return;
    }
  });

  const results = Object.values(projectMap).map(p => {
    const existing = existingProjects.find(ep => ep.code && ep.code.trim().toUpperCase() === p.code);
    
    // Merge employeeSkills and employeeInfo to preserve previously added resources based on mode
    const mergeAllocations = (existingAlloc: any, incomingAlloc: any, projectSeenMonths: Set<number>) => {
      const merged = JSON.parse(JSON.stringify(existingAlloc || {}));
      Object.entries(incomingAlloc || {}).forEach(([skill, emps]) => {
        if (!merged[skill]) merged[skill] = {};
        Object.entries(emps as Record<string, number[]>).forEach(([email, allocs]) => {
          if (!merged[skill][email]) merged[skill][email] = new Array(MAX_MONTHS).fill(0);
          projectSeenMonths.forEach(m => {
            merged[skill][email][m] = (allocs || [])[m] || 0;
          });
        });
      });
      return merged;
    };

    const nextPmoEmployeeSkills = mode === 'Budget'
      ? mergeAllocations(existing?.pmoEmployeeSkills, p.employeeSkills, p.seenMonths)
      : (existing?.pmoEmployeeSkills || {});

    const nextEmployeeSkills = existing?.employeeSkills || {};

    const nextActualsEmployeeSkills = mode === 'Actuals'
      ? mergeAllocations(existing?.actualsEmployeeSkills, p.employeeSkills, p.seenMonths)
      : (existing?.actualsEmployeeSkills || {});

    const nextForecastEmployeeSkills = mode === 'Forecast'
      ? mergeAllocations(existing?.forecastEmployeeSkills, p.employeeSkills, p.seenMonths)
      : (existing?.forecastEmployeeSkills || {});

    const mergeExpenseDetails = (existingDet: any, incomingDet: any, projectSeenMonths: Set<number>) => {
      const merged = JSON.parse(JSON.stringify(existingDet || {}));
      Object.entries(incomingDet || {}).forEach(([cat, details]) => {
        if (!merged[cat]) merged[cat] = {};
        Object.entries(details as Record<string, number[]>).forEach(([dtl, allocs]) => {
          if (!merged[cat][dtl]) merged[cat][dtl] = new Array(MAX_MONTHS).fill(0);
          projectSeenMonths.forEach(m => {
            merged[cat][dtl][m] = (allocs || [])[m] || 0;
          });
        });
      });
      return merged;
    };

    const nextPmoExpenseDetails = mode === 'Budget'
      ? mergeExpenseDetails(existing?.pmoExpenseDetails, p.expenseDetails, p.seenMonths)
      : (existing?.pmoExpenseDetails || {});

    const nextActualsExpenseDetails = mode === 'Actuals'
      ? mergeExpenseDetails(existing?.actualsExpenseDetails, p.expenseDetails, p.seenMonths)
      : (existing?.actualsExpenseDetails || {});

    const nextForecastExpenseDetails = mode === 'Forecast'
      ? mergeExpenseDetails(existing?.forecastExpenseDetails, p.expenseDetails, p.seenMonths)
      : (existing?.forecastExpenseDetails || {});

    const mergedEmployeeInfo = { ...(existing?.employeeInfo || {}), ...p.employeeInfo };

    const combinedData = { ...p.skills, ...p.expenses };
    
    const mergeData = (existingData: any, newData: any, projectSeenMonths: Set<number>) => {
      const merged = { ...existingData };
      Object.entries(newData).forEach(([cat, arr]: [string, any]) => {
        if (!merged[cat]) merged[cat] = new Array(MAX_MONTHS).fill(0);
        
        // Ensure merged[cat] is an array or handled as object
        const isArray = Array.isArray(merged[cat]);
        
        projectSeenMonths.forEach(i => {
          if (isArray) {
            merged[cat][i] = Math.round(((arr[i] || 0) + Number.EPSILON) * 100) / 100;
          } else {
            merged[cat][String(i)] = Math.round(((arr[i] || 0) + Number.EPSILON) * 100) / 100;
          }
        });
      });
      return merged;
    };

    let pmoRows = existing?.pmoRows || {};
    let actuals = existing?.actuals || {};
    let forecast = existing?.forecast || {};
    let pmoSkills = existing?.pmoSkills || {};
    let skills = existing?.skills || {};
    let expenses = existing?.expenses || {};

    if (mode === 'Actuals') {
      actuals = mergeData(actuals, combinedData, p.seenMonths);
    } else if (mode === 'Forecast') {
      forecast = mergeData(forecast, combinedData, p.seenMonths);
    } else {
      pmoRows = mergeData(pmoRows, combinedData, p.seenMonths);
      if (p.skills && Object.keys(p.skills).length > 0) {
        pmoSkills = mergeData(pmoSkills, p.skills, p.seenMonths);
      }
    }

    let totalBudgetFTE = 0;
    let totalBudgetExpense = 0;
    
    // Always calculate budget from the 'pmoRows' object (which represents the budget)
    Object.entries(pmoRows).forEach(([cat, months]: [string, any]) => {
      const isManpower = !EXPENSE_CATEGORIES.includes(cat as any);
      const isExpense = EXPENSE_CATEGORIES.includes(cat as any);
      
      let sum = 0;
      if (Array.isArray(months)) {
        months.forEach((v, i) => {
           if (validMonthIndices.has(i)) sum += v || 0;
        });
      }
      
      if (isManpower) totalBudgetFTE += sum;
      else if (isExpense) {
        if (cat === 'Contracted Employee') {
          totalBudgetExpense += (sum * contractedRate * hpm) / 10000000;
        } else if (cat !== 'Contracted Employee Expense') {
          totalBudgetExpense += sum;
        }
      }
    });

    const calculatedBudgetCr = ((totalBudgetFTE * hourlyRate * hpm) / 10000000) + totalBudgetExpense;
    const isFixedMode = (existing?.budgetMode || 'detailed') === 'fixed';
    const portfolioBudgetCr = isFixedMode && existing?.portfolioBudgetCr !== undefined ? existing.portfolioBudgetCr : calculatedBudgetCr;
    const actualSpentCr = p.actualSpent;
    const manpowerSpentCr = p.manpowerSpent;
    const expenseSpentCr = p.expenseSpent;

    const actualsFYs = Array.from(new Set([...(existing?.actualsFYs || []), mode === 'Actuals' ? currentSelectedFY : null].filter(Boolean)));
    const forecastFYs = Array.from(new Set([...(existing?.forecastFYs || []), mode === 'Forecast' ? currentSelectedFY : null].filter(Boolean)));
    const budgetFYs = Array.from(new Set([...(existing?.budgetFYs || []), mode === 'Budget' ? currentSelectedFY : null].filter(Boolean)));

    return {
      ...p,
      name: existing?.name || p.name,
      rows: existing?.rows || {},
      pmoRows,
      actuals,
      forecast,
      actualsFYs,
      forecastFYs,
      budgetFYs,
      pmoSkills,
      skills,
      expenses,
      igGates: existing?.igGates || p.igGates || [],
      tbc: existing?.tbc || 'Yes',
      vertical: existing?.vertical || p.vertical || 'SUPPORT',
      category: existing?.category || p.category || 'NPC',
      productFamily: existing?.productFamily || p.productFamily || 'SUPPORT',
      pace: existing?.pace || '-',
      buDomain: existing?.buDomain || 'NA',
      pmoEmployeeSkills: nextPmoEmployeeSkills,
      employeeSkills: nextEmployeeSkills,
      actualsEmployeeSkills: nextActualsEmployeeSkills,
      forecastEmployeeSkills: nextForecastEmployeeSkills,
      pmoExpenseDetails: nextPmoExpenseDetails,
      actualsExpenseDetails: nextActualsExpenseDetails,
      forecastExpenseDetails: nextForecastExpenseDetails,
      employeeInfo: mergedEmployeeInfo,
      projectTasks: p.projectTasks,
      employeeTasks: p.employeeTasks,
      businessUnit: existing?.businessUnit || 'NA',
      projectType: existing?.projectType || 'NA',
      pdh: existing?.pdh || 'NA',
      customer: existing?.customer || '',
      segment: existing?.segment || 'NA',
      sopMonth: existing?.sopMonth || '',
      sopFyYear: existing?.sopFyYear || '',
      currentGate: existing?.currentGate || '',
      forecastMonths: existing?.forecastMonths || 0,
      prevYearBudget: existing?.prevYearBudget || 0,
      budgetMode: existing?.budgetMode || 'detailed',
      expenseTillMar26: existing?.expenseTillMar26 || 0,
      isLocked: existing?.isLocked || false,
      portfolioBudgetCr,
      actualSpentCr,
      manpowerSpentCr,
      expenseSpentCr,
      remaining: portfolioBudgetCr - actualSpentCr,
      totalMM: p.monthlyFTEs.reduce((acc, v, idx) => {
        const fIdx = Math.floor(idx / 12);
        const fYearTarget = 19 + fIdx;
        const fStr = `FY ${fYearTarget}-${fYearTarget + 1}`;
        if (isAllFY || fyStrings.includes(fStr as any)) {
          return acc + v;
        }
        return acc;
      }, 0),
      burnRate: portfolioBudgetCr > 0 ? (actualSpentCr / portfolioBudgetCr) * 100 : 0
    };
  });

  return { results, metadata: { processedCount, dateErrorCount, fyMismatchCount, totalRows: rawData.length } };
};

interface PMOProps {
  existingProjects: ProjectData[];
  selectedFYs: FiscalYear | FiscalYear[];
  setSelectedFY: (fy: FiscalYear | FiscalYear[]) => void;
  masterConfig: MasterConfigState;
  activeTab?: 'list' | 'analytics';
  rawData: any[];
  setRawData: (data: any[]) => void;
  fileName: string;
  setFileName: (name: string) => void;
  mode: FiscalMode;
  setMode: (mode: FiscalMode) => void;
  months: string[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
  triggerLocalUpdate: () => void;
  isLocked?: boolean;
  employees: Employee[];
  isAdmin?: boolean;
  onDeleteAll?: () => void;
  masterProjects?: MasterProject[];
  lastUpdated?: number;
}

const isNew = (cat: string) => (cat || '').trim().toLowerCase().includes('new');
const isCO = (cat: string) => (cat || '').trim().toLowerCase().includes('co');

const ensureArray = (data: any, length: number = 12) => {
  if (Array.isArray(data)) {
    if (data.length < length) {
      const arr = new Array(length).fill(0);
      data.forEach((v, i) => { if (i < length) arr[i] = v; });
      return arr;
    }
    return data;
  }
  const arr = new Array(length).fill(0);
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => {
      const idx = parseInt(k);
      if (!isNaN(idx) && idx >= 0 && idx < length) {
        arr[idx] = typeof v === 'number' ? v : (typeof v === 'string' ? v : 0);
      }
    });
  }
  return arr;
};

interface ProcessedProject extends ProjectData {
  actualSpent: number;
  manpowerSpent: number;
  expenseSpent: number;
  monthlyFTEs: number[];
  monthlyActuals: number[];
  portfolioBudgetCr: number;
  actualSpentCr: number;
  manpowerSpentCr: number;
  expenseSpentCr: number;
  remaining: number;
  totalMM: number;
  burnRate: number;
  importStatus?: 'valid' | 'update' | 'error';
  importErrors?: string[];
  seenMonths: Set<number>;
}

const MetaItem = ({ label, value, maxW = "max-w-[60px]" }: { label: string; value: string; maxW?: string }) => (
  <div className={`flex flex-col min-w-0 ${maxW}`}>
    <span className="text-[6px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-0.5">{label}</span>
    <span className="text-[9px] font-black text-slate-700 truncate leading-none uppercase">{value || '-'}</span>
  </div>
);

const formatCr = (val: number) => {
  if (!val || Math.abs(val) < 0.000001) return "0.00";
  return (Math.round(val * 100) / 100).toFixed(2);
};

const PMO: React.FC<PMOProps> = ({ 
  existingProjects, 
  selectedFYs, 
  setSelectedFY, 
  masterConfig, 
  activeTab = 'list',
  rawData,
  setRawData,
  fileName,
  setFileName,
  mode,
  setMode,
  months,
  setProjects,
  triggerLocalUpdate,
  isLocked = false,
  employees: masterEmployees,
  isAdmin = false,
  onDeleteAll,
  masterProjects = [],
  lastUpdated
}) => {
  const selectedFY = Array.isArray(selectedFYs) ? selectedFYs[0] : (selectedFYs as FiscalYear);
  
  const isResourceAllocationLockedForProject = (p: ProjectData) => {
    if (masterConfig.isFiscalLocked) return true;
    if (p.isLocked) return true;
    
    // Determine the concrete years to check for this project
    const projectYears: string[] = [];
    if (p.fiscalYear && p.fiscalYear !== 'All FY') {
      projectYears.push(p.fiscalYear);
    } else {
      // Fallback: use selectedFYs
      const currentFYsStr = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs];
      currentFYsStr.forEach(fy => {
        if (fy === 'All FY') {
          ALL_FISCAL_YEARS.filter(y => y !== 'All FY').forEach(y => projectYears.push(y));
        } else {
          projectYears.push(fy);
        }
      });
    }

    // Check if any of these years has active locks for PMO master, budget, or forecast
    return projectYears.some(fy => {
      return !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_master`] ||
             !!masterConfig.fiscalLocks?.[`budget_page_${fy}`] ||
             !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Budget`] ||
             !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Actuals`] ||
             !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Forecast`];
    });
  };

  const isProjectPartLocked = (p: ProjectData, part: 'Budget' | 'Forecast' | 'Actuals' | 'master') => {
    if (masterConfig.isFiscalLocked) return true;
    if (p.isLocked) return true;
    
    // Determine the concrete years to check for this project
    const projectYears: string[] = [];
    if (p.fiscalYear && p.fiscalYear !== 'All FY') {
      projectYears.push(p.fiscalYear);
    } else {
      // Fallback: use selectedFYs
      const currentFYsStr = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs];
      currentFYsStr.forEach(fy => {
        if (fy === 'All FY') {
          ALL_FISCAL_YEARS.filter(y => y !== 'All FY').forEach(y => projectYears.push(y));
        } else {
          projectYears.push(fy as string);
        }
      });
    }

    // Check if any of these years has an active lock
    return projectYears.some(fy => {
      if (!!masterConfig.fiscalLocks?.[`pmo_page_${fy}_master`]) return true;
      if (part !== 'master' && !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_${part}`]) return true;
      
      // If it's the budget part, check if budget workspace lock is also active just to be safe
      if (part === 'Budget' && !!masterConfig.fiscalLocks?.[`budget_page_${fy}`]) return true;
      return false;
    });
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});
  const toggleSkill = (skill: string) => {
    setExpandedSkills(prev => ({ ...prev, [skill]: !prev[skill] }));
  };
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isImportInspectionOpen, setIsImportInspectionOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [importStats, setImportStats] = useState({ newProjects: 0, updateProjects: 0, totalRows: 0 });
  const [tempRawData, setTempRawData] = useState<any[] | null>(null);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [importType, setImportType] = useState<'raw' | 'processed'>('raw');
  const [processedImportData, setProcessedImportData] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const forceUpdate = () => setRenderKey(prev => prev + 1);

  React.useEffect(() => {
    if (statusMessage && statusMessage.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const [activeInnerTab, setActiveInnerTab] = useState<Record<string, 'info' | 'estimation' | 'forecast' | 'analytics' | 'roster' | 'employeeAnalysis' | 'expenseList' | 'team' | 'tasks' | 'allocation'>>({});
  const [expandedTaskLists, setExpandedTaskLists] = useState<Record<string, boolean>>({});
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});
  const [taskViewMode, setTaskViewMode] = useState<'hours' | 'percentage'>('hours');
  
  const toggleTaskList = (projectCode: string, taskList: string) => {
    const key = `${projectCode}-${taskList}`;
    setExpandedTaskLists(prev => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const toggleEmployee = (projectCode: string, email: string) => {
    const key = `${projectCode}-${email}`;
    setExpandedEmployees(prev => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    search: '',
    projectId: ['All'],
    vertical: ['All'], 
    domain: ['All'], 
    bu: ['All'], 
    customer: ['All'],
    projectType: ['All'], 
    tbc: ['Yes'], 
    category: ['All'], 
    family: ['All'], 
    pdh: ['All'],
    generation: ['All']
  });

  const [sortBy, setSortBy] = useState<'default' | 'manpower' | 'expense' | 'total'>('default');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const yearOffset = useMemo(() => {
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFY = fyStrings.includes('All FY');
    if (isAllFY) return 0;
    
    const startYears = fyStrings.map(fy => {
      const match = fy.match(/\d+/);
      return match ? parseInt(match[0]) : 25;
    });
    const minYear = Math.min(...startYears);
    return (minYear - 19) * 12;
  }, [selectedFYs]);

  const yearLimit = useMemo(() => {
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFY = fyStrings.includes('All FY');
    if (isAllFY) return MAX_MONTHS;
    
    const startYears = fyStrings.map(fy => {
      const match = fy.match(/\d+/);
      return match ? parseInt(match[0]) : 25;
    });
    const minYear = Math.min(...startYears);
    const maxYear = Math.max(...startYears);
    return (maxYear - minYear + 1) * 12;
  }, [selectedFYs]);

  const globalResourceUtilization = useMemo(() => {
    const utilization: Record<string, number[]> = {};
    const empSkillsKey = mode === 'Actuals' ? 'actualsEmployeeSkills' : (mode === 'Forecast' ? 'forecastEmployeeSkills' : 'pmoEmployeeSkills');

    existingProjects.forEach(p => {
      const skillsObj = p[empSkillsKey] || (mode === 'Budget' ? p.employeeSkills : undefined);
      if (!skillsObj) return;
      Object.entries(skillsObj).forEach(([skill, emps]) => {
        Object.entries(emps).forEach(([email, allocs]) => {
          if (!utilization[email]) utilization[email] = new Array(MAX_MONTHS).fill(0);
          let monthArray: number[];
          if (Array.isArray(allocs)) {
            monthArray = allocs;
          } else {
            monthArray = new Array(MAX_MONTHS).fill(0);
            if (allocs && typeof allocs === 'object') {
              Object.entries(allocs).forEach(([k, v]) => {
                const idx = parseInt(k);
                if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) {
                  monthArray[idx] = Number(v) || 0;
                }
              });
            }
          }
          monthArray.forEach((val: any, idx: number) => {
            if (idx < MAX_MONTHS) utilization[email][idx] += (val || 0);
          });
        });
      });
    });
    return utilization;
  }, [existingProjects, mode]);

  const monthIndices = useMemo(() => {
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    return months.map(m => {
      const [monthName, yearShort] = m.split('-');
      const year = 2000 + parseInt(yearShort);
      const month = monthMap[monthName] || 0;
      return (year - 2019) * 12 + month - 3;
    });
  }, [months]);

  const currentMonthIndex = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (Jan=0)
    
    // Month name to match (e.g., "Apr-25")
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthStr = `${monthNames[currentMonth]}-${String(currentYear).slice(-2)}`;
    
    const idx = (months || []).findIndex(m => m === currentMonthStr);
    
    // If not found in exact months (e.g. looking at future/past year), 
    // we determine if we are before or after this range.
    if (idx === -1) {
       if (months && months.length > 0) {
          const firstMonthAbs = getAbsoluteMonthIndex(months[0]);
          const currentAbs = (currentYear - 2019) * 12 + (currentMonth - 3); // April 2019 start
          if (currentAbs < firstMonthAbs) return 0; // Future looking
          return months.length; // Past looking
       }
       return -1;
    }
    return idx;
  }, [months]);

  const getProjectRowsData = (p: ProjectData, targetMode: FiscalMode) => {
    const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
    const targetKey = targetMode === 'Actuals' ? 'actuals' : (targetMode === 'Forecast' ? 'forecast' : 'pmoRows');
    
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFYLocal = fyStrings.includes('All FY');
    const startYears = fyStrings.map(fy => {
      const match = fy.match(/\d+/);
      return (match && match[0]) ? parseInt(match[0]) : 25;
    });
    const minYearLocal = Math.min(...startYears);
    const yearOffsetLocal = isAllFYLocal ? 0 : (minYearLocal - 19) * 12;

    const manpowerRows = Object.fromEntries([...MANPOWER_CATEGORIES.filter(cat => cat !== 'Consultant'), 'Contracted Employee'].map(cat => {
      const row = getAuthoritativeRowUI(p as any, cat, targetKey);
      const arr = ensureArray(row || [], MAX_MONTHS);
      const sliced = months.map((_, i) => arr[monthIndices[i]] || 0);
      return [cat, sliced.map(v => Math.round(v * 100) / 100)];
    }));

    const fy = p.fiscalYear || selectedFY;
    const fyConfig = masterConfig.fyFinancials?.[fy];
    const contractedRate = (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : CONTRACTED_EMPLOYEE_RATE;
    const hpm = 180;

    const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
    for (let i = 0; i < months.length; i++) {
        const monthIdx = i + yearOffsetLocal;
        const startYear = 19 + Math.floor(monthIdx / 12);
        const fyStr = `FY ${startYear}-${startYear + 1}`;
        const fyConfig = masterConfig.fyFinancials?.[fyStr];
        ratesCache[i] = {
            hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
            cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
        };
    }

    const expenseRows = Object.fromEntries(EXPENSE_CATEGORIES.filter(cat => cat !== 'Contracted Employee').map(cat => {
      const isContractedExp = cat === 'Contracted Employee Expense';
      let rowArray: number[];
      
      const rawRow = getAuthoritativeRowUI(p as any, cat, targetKey);
      
      if (isContractedExp) {
        const hasDirectExp = rawRow.some(v => v !== 0);
        if (!hasDirectExp) {
          const mmRow = getAuthoritativeRowUI(p as any, 'Contracted Employee', targetKey);
          rowArray = ensureArray(mmRow, MAX_MONTHS).map(mm => isHolidayLeave ? 0 : Math.round(((mm * contractedRate * hpm) / 10000000) * 100) / 100);
        } else {
          rowArray = ensureArray(rawRow || [], MAX_MONTHS).map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
        }
      } else {
        rowArray = ensureArray(rawRow || [], MAX_MONTHS).map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
      }
      
      const sliced = months.map((_, i) => rowArray[monthIndices[i]] || 0);
      return [cat, sliced];
    }));

    const otherManpowerRows = {};

    const otherExpenseRows = Object.fromEntries(Object.keys({ ...(p.expenses || {}), ...(p[targetKey] || {}) }).filter(cat => 
      !(EXPENSE_CATEGORIES as readonly string[]).includes(cat) && 
      !(MANPOWER_CATEGORIES as readonly string[]).includes(cat) && 
      cat !== 'Contracted Employee' && 
      cat !== 'Contracted Employee Expense' &&
      !isSummaryOrCalculatedLabel(cat)
    ).map(cat => {
      const arr = getAuthoritativeRowUI(p as any, cat, targetKey);
      const sliced = months.map((_, i) => arr[monthIndices[i]] || 0);
      const slicedCost = sliced.map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
      return [cat, slicedCost];
    }));

    const directMM = months.map((_, i) => {
        const globalIdx = monthIndices[i];
        return MANPOWER_CATEGORIES.filter(cat => cat !== 'Consultant').reduce((acc, cat) => {
            const arr = getAuthoritativeRowUI(p as any, cat, targetKey);
            return acc + (arr[globalIdx] || 0);
        }, 0);
    });
    const contractedMM = months.map((_, i) => {
        const globalIdx = monthIndices[i];
        const arr = getAuthoritativeRowUI(p as any, 'Contracted Employee', targetKey);
        return arr[globalIdx] || 0;
    });
    const totalMM = directMM.map((v, i) => Math.round((v + contractedMM[i]) * 100) / 100);
    const directCr = isHolidayLeave ? new Array(months.length).fill(0) : directMM.map((v, i) => Math.round(((v * ratesCache[i].hRate * hpm) / 10000000) * 100) / 100);
    const contractedCr = isHolidayLeave ? new Array(months.length).fill(0) : contractedMM.map((v, i) => Math.round(((v * ratesCache[i].cRate * hpm) / 10000000) * 100) / 100);
    const totalManpowerCr = directCr.map((v, i) => Math.round((v + contractedCr[i]) * 100) / 100);

    const monthlyExpCr = isHolidayLeave ? new Array(months.length).fill(0) : months.map((_, i) => {
        const globalIdx = monthIndices[i];
        const allCategories = new Set<string>([
          ...EXPENSE_CATEGORIES,
          ...Object.keys(p.pmoRows || {}),
          ...Object.keys(p.rows || {}),
          ...Object.keys(p.actuals || {}),
          ...Object.keys(p.forecast || {}),
          ...Object.keys(p.skills || {}),
          ...Object.keys(p.expenses || {}),
          ...Object.keys(p.employeeSkills || {}),
          ...Object.keys(p.actualsEmployeeSkills || {}),
          ...Object.keys(p.forecastEmployeeSkills || {})
        ]);
        return Array.from(allCategories).reduce((acc, cat) => {
            const mappedCat = SKILL_MAPPING[cat] || cat;
            if (mappedCat === 'Contracted Employee' || MANPOWER_CATEGORIES.includes(mappedCat as any)) return acc;
            const arr = getAuthoritativeRowUI(p as any, cat, targetKey);
            return acc + (arr[globalIdx] || 0);
        }, 0);
    }).map(v => Math.round(v * 100) / 100);

    const grandTotal = totalManpowerCr.map((v, i) => Math.round((v + monthlyExpCr[i]) * 100) / 100);
    const aggMM = totalMM.reduce((a, b) => a + b, 0);
    const aggManpowerCr = totalManpowerCr.reduce((a, b) => a + b, 0);
    const aggExpCr = monthlyExpCr.reduce((a, b) => a + b, 0);
    const aggTotalCr = grandTotal.reduce((a, b) => a + b, 0);

    return { 
        manpowerRows, 
        expenseRows,
        otherManpowerRows,
        otherExpenseRows,
        totalMM,
        totalManpowerCr,
        directCr,
        contractedCr,
        monthlyExpCr,
        grandTotal,
        aggMM,
        aggManpowerCr,
        aggExpCr,
        aggTotalCr
    };
  };

  const handleExport = async () => {
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const exportFY = fyStrings[0] || DEFAULT_FY;
    
    if (!exportFY) {
      setStatusMessage({ type: 'error', text: 'Please select a Fiscal Year to export.' });
      return;
    }
    setIsProcessing(true);
    setStatusMessage({ type: 'info', text: 'Preparing export...' });
    try {
      await exportProjectRegistry(
        processedProjects.results || [],
        masterConfig,
        exportFY,
        months,
        mode === 'Budget' ? 'PMO_Budget' : mode,
        true,
        filters
      );
      setStatusMessage({ type: 'success', text: 'Export completed successfully.' });
    } catch (err) {
      console.error('Export failed:', err);
      setStatusMessage({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProjectExport = async (p: ProjectData) => {
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const exportFY = (p.fiscalYear || fyStrings[0] || DEFAULT_FY) as FiscalYear;
    
    setIsProcessing(true);
    setStatusMessage({ type: 'info', text: `Preparing export for project ${p.code}...` });
    try {
      await exportProjectRegistry(
        [p],
        masterConfig,
        exportFY,
        months,
        mode === 'Budget' ? 'PMO_Budget' : mode,
        true,
        undefined,
        true
      );
      setStatusMessage({ type: 'success', text: `Exported ${p.code} successfully.` });
    } catch (err) {
      console.error('Project export failed:', err);
      setStatusMessage({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setIsProcessing(true);
      setProcessingProgress(0);
      setStatusMessage({ type: 'info', text: 'Reading file...' });

      if (importType === 'raw') {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const arrayBuffer = evt.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
              setStatusMessage({ type: 'error', text: 'Failed to read file' });
              return;
            }
            
            setStatusMessage({ type: 'info', text: 'Parsing large Excel file (this may take 20-40 seconds)...' });
            
            const uint8 = new Uint8Array(arrayBuffer);
            const header = uint8.slice(0, 4);
            const signature = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Optimization for large files: use dense mode to save memory
            const wb = XLSX.read(uint8, { 
              type: 'array',
              cellStyles: false,
              cellFormula: false,
              cellHTML: false,
              cellDates: true,
              dense: true,
              bookVBA: false,
              bookDeps: false,
              bookSheets: false
            });
            
            if (!wb.SheetNames || wb.SheetNames.length === 0) {
              setStatusMessage({ type: 'error', text: `No sheets found. Signature: ${signature}. (Size: ${(file.size / 1024 / 1024).toFixed(2)} MB)` });
              return;
            }
            
            // AGGRESSIVE SHEET DISCOVERY
            const allSheetKeys = wb && wb.Sheets ? Object.keys(wb.Sheets) : [];
            console.log("Sheets found:", wb.SheetNames, "Keys:", allSheetKeys);
            
            let wsname = "";
            let ws: any = null;
            let maxCells = -1;

            // 1. Try to find the sheet with the most data cells
            (wb.SheetNames || []).forEach(name => {
              const s = wb.Sheets ? wb.Sheets[name] : null;
              let cellCount = 0;
              
              if (s) {
                if (s['!data'] && Array.isArray(s['!data'])) {
                  // Dense mode
                  s['!data'].forEach((row: any) => {
                    if (row && Array.isArray(row)) {
                      cellCount += row.filter(c => c && (c.v !== undefined || c.w !== undefined || c.r !== undefined)).length;
                    }
                  });
                } else {
                  // Non-dense mode
                  cellCount = Object.keys(s).filter(k => k[0] !== '!').length;
                }
                
                console.log(`Sheet "${name}" has approx ${cellCount} cells`);
              }
              
              if (cellCount > maxCells) {
                maxCells = cellCount;
                wsname = name;
                ws = s;
              }
            });

            // 2. If no data cells found, try to find by name "Master"
            if (maxCells <= 0) {
              const masterKey = allSheetKeys.find(k => k.toLowerCase().includes('master')) || 
                                wb.SheetNames.find(n => n.toLowerCase().includes('master'));
              if (masterKey) {
                wsname = masterKey;
                ws = wb && wb.Sheets ? wb.Sheets[masterKey] : null;
              }
            }

            // 3. Final fallback: first sheet
            if (!ws) {
              wsname = wb.SheetNames[0];
              ws = wb && wb.Sheets ? wb.Sheets[wsname] : null;
            }
            
            let data: any[] = [];
            try {
              if (ws && !ws['!ref'] && ws['!data']) {
                // Manually calculate range for dense sheets if missing
                let maxR = ws['!data'].length - 1;
                let maxC = 0;
                ws['!data'].forEach((row: any) => {
                  if (row && row.length > maxC) maxC = row.length;
                });
                if (maxR >= 0 && maxC > 0) {
                  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC - 1 } });
                }
              }

              // Try standard extraction
              data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 0 }) as any[];

              // Fallback: Manual cell-by-cell extraction if standard parsing fails but cells exist
              if (data.length === 0 && ws) {
                console.log("Standard extraction returned 0 rows, trying manual fallback...");
                // Handle dense mode fallback
                if (ws['!data'] && Array.isArray(ws['!data'])) {
                  ws['!data'].forEach((row: any) => {
                    if (row && Array.isArray(row)) {
                      const rowData = row.map(c => {
                        if (!c) return '';
                        if (c.v !== undefined && c.v !== null) return c.v;
                        if (c.w !== undefined) return c.w;
                        return '';
                      });
                      if (rowData.some(v => v !== '' && v !== null && v !== undefined)) data.push(rowData);
                    }
                  });
                } else {
                  // Non-dense mode fallback
                  const cellKeys = ws ? Object.keys(ws).filter(k => k[0] !== '!') : [];
                  if (cellKeys.length > 0) {
                    let minR = 1000000, maxR = 0, minC = 1000, maxC = 0;
                    cellKeys.forEach(key => {
                      try {
                        const cell = XLSX.utils.decode_cell(key);
                        if (cell.r < minR) minR = cell.r;
                        if (cell.r > maxR) maxR = cell.r;
                        if (cell.c < minC) minC = cell.c;
                        if (cell.c > maxC) maxC = cell.c;
                      } catch(e) {}
                    });
                    
                    maxR = Math.min(maxR, 1000000); 
                    maxC = Math.min(maxC, 200); 
                    
                    for (let r = minR; r <= maxR; r++) {
                      const row = [];
                      let hasRowData = false;
                      for (let c = minC; c <= maxC; c++) {
                        const addr = XLSX.utils.encode_cell({ r, c });
                        const cell = ws[addr];
                        const val = cell ? cell.v : '';
                        row.push(val);
                        if (val !== '' && val !== undefined && val !== null) hasRowData = true;
                      }
                      if (hasRowData) data.push(row);
                    }
                  }
                }
              }
            } catch (jsonErr: any) {
              console.error("Excel processing error:", jsonErr);
              const msg = jsonErr?.message || '';
              if (msg.toLowerCase().includes('password')) {
                setStatusMessage({ type: 'error', text: 'This Excel file is password-protected. Please remove the password and try again.' });
              } else {
                setStatusMessage({ type: 'error', text: 'Memory limit reached while processing this large file. Please try splitting the file into smaller parts.' });
              }
              return;
            }
            
            if (data.length === 0) {
              try {
                setStatusMessage({ type: 'info', text: 'Retrying with secondary parser (ExcelJS) for large file...' });
                const workbook = new ExcelJS.Workbook();
                
                // Use a try-catch specifically for the load operation
                try {
                  // Use Uint8Array instead of ArrayBuffer for better compatibility
                  await workbook.xlsx.load(uint8);
                } catch (loadErr: any) {
                  // If load fails with the specific sheetNo error, it's a known exceljs bug
                  if (loadErr?.message?.includes('sheetNo')) {
                    console.warn("Detected known ExcelJS sheetNo bug, skipping ExcelJS fallback.");
                  } else {
                    console.error("ExcelJS load error:", loadErr);
                  }
                  throw loadErr;
                }
                
                let worksheet = workbook.getWorksheet(wsname);
                if (!worksheet) {
                  worksheet = workbook.worksheets.find(w => w.name && w.name.toLowerCase() === wsname.toLowerCase());
                }
                
                // If still no worksheet, pick the one with most rows
                if (!worksheet || (worksheet.rowCount === 0 && workbook.worksheets.length > 0)) {
                   let maxR = -1;
                   workbook.worksheets.forEach(w => {
                     if (w && w.rowCount > maxR) {
                       maxR = w.rowCount;
                       worksheet = w;
                     }
                   });
                }
                
                if (worksheet && worksheet.rowCount > 0) {
                  const rows: any[] = [];
                  const maxCol = Math.min(worksheet.columnCount || 100, 100); // Limit columns for safety
                  
                  worksheet.eachRow({ includeEmpty: true }, (row) => {
                    const rowData = [];
                    for (let i = 1; i <= maxCol; i++) {
                      const cell = row.getCell(i);
                      let val = cell ? cell.value : '';
                      
                      // Handle ExcelJS rich text or formula objects
                      if (val && typeof val === 'object') {
                        if ('result' in (val as any)) val = (val as any).result;
                        else if ('richText' in (val as any)) val = (val as any).richText.map((t: any) => t.text).join('');
                        else if (val instanceof Date) { /* keep as date */ }
                        else if ('formula' in (val as any)) val = (val as any).result || '';
                        else val = String(val);
                      }
                      rowData.push(val === null ? '' : val);
                    }
                    if (rowData.some(v => v !== '' && v !== null && v !== undefined)) {
                      rows.push(rowData);
                    }
                  });
                  
                  if (rows.length > 0) {
                    data = rows;
                    wsname = worksheet.name || wsname;
                  }
                }
              } catch (excelJsErr: any) {
                if (!excelJsErr?.message?.includes('sheetNo')) {
                  console.error("ExcelJS fallback error details:", excelJsErr);
                }
              }
            }
            
            if (data.length === 0) {
              const wsKeys = ws ? Object.keys(ws).length : 0;
              const wbKeys = allSheetKeys.length;
              const ref = ws ? ws['!ref'] : 'N/A';
              setStatusMessage({ type: 'error', text: `No data rows found in "${wsname}". (Cells: ${maxCells}, Ref: ${ref}, SheetKeys: ${wbKeys}, Sig: ${signature}, Sheets: ${wb.SheetNames.join(', ')}). Size: ${(file.size / 1024 / 1024).toFixed(2)} MB` });
              return;
            }
            
            setStatusMessage({ type: 'info', text: `Processing sheet: ${wsname} (${data.length} rows)...` });
            
            // Calculate stats for confirmation
            let codeIdx = -1;
            const headerRow = data.find(row => 
              Array.isArray(row) && row.some(cell => {
                const s = String(cell || '').toLowerCase();
                return s.includes('project code') || s.includes('project name') || s.includes('record type') || s.includes('role hr master 2') || s.includes('functional unit') || s === 'month' || s === 'hours' || s === 'amount';
              })
            );
            
            if (!headerRow) {
              setStatusMessage({ type: 'error', text: `Could not find a valid header row in sheet "${wsname}". Please ensure columns like "Project Code" or "Month" exist.` });
              return;
            }
            
            if (headerRow && Array.isArray(headerRow)) {
              codeIdx = headerRow.findIndex(cell => {
                const s = String(cell || '').toLowerCase().trim();
                return s.includes('project code') || s === 'code' || s === 'id' || s === 'project_code';
              });
            }
            
            // Fallback if not found
            if (codeIdx === -1) codeIdx = 0;

            const headerRowIdx = data.indexOf(headerRow);
            const codes = new Set<string>();
            data.forEach((row, idx) => {
              if (idx <= headerRowIdx) return; // Skip header and anything above it
              if (Array.isArray(row) && row[codeIdx]) {
                const code = String(row[codeIdx]).trim().toUpperCase();
                if (code && code !== 'PROJECT CODE' && code !== 'CODE' && code !== 'ID' && !code.includes('TIMESHEET')) {
                  codes.add(code);
                }
              }
            });

            let newCount = 0;
            let updateCount = 0;
            const targetKey = mode === 'Actuals' ? 'actuals' : mode === 'Forecast' ? 'forecast' : 'pmoRows';
            
            codes.forEach(code => {
              const existing = (existingProjects || []).find(ep => ep.code?.trim().toUpperCase() === code);
              const hasDataInMode = existing && (existing as any)[targetKey] && Object.keys((existing as any)[targetKey] || {}).length > 0;
              
              if (hasDataInMode) {
                updateCount++;
              } else {
                newCount++;
              }
            });

            setImportStats({ newProjects: newCount, updateProjects: updateCount, totalRows: data.length });
            setTempRawData(data);
            setIsConfirmModalOpen(true);
            setStatusMessage({ type: 'info', text: 'Waiting for confirmation...' });
          } catch (err) {
            console.error("Import error:", err);
            setStatusMessage({ type: 'error', text: `Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}` });
          } finally {
            setIsProcessing(false);
            setProcessingProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.onerror = () => {
          setStatusMessage({ type: 'error', text: 'Error reading file' });
          setIsProcessing(false);
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      try {
        const data = await processExcelImport(
          file, 
          masterConfig, 
          existingProjects, 
          months, 
          mode === 'Budget' ? 'PMO_Budget' : mode, 
          (p, m) => {
            setProcessingProgress(p);
            setStatusMessage({ type: 'info', text: m });
          }, 
          'processed',
          masterEmployees
        );
        
        setPendingImportData(data);
        setIsImportInspectionOpen(true);
        setStatusMessage({ type: 'success', text: `Successfully processed ${data.projects.length} projects from ${file.name}` });
      } catch (err) {
        setStatusMessage({ type: 'error', text: `Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}` });
      } finally {
        setIsProcessing(false);
        setProcessingProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}` });
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const processedProjects = useMemo(() => {
    if (importType === 'processed' && processedImportData) {
      const baseResults = processedImportData.projects.map((p: any) => {
        const targetKey = mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows');
        const data = (activeTab === 'analytics') 
            ? { ...(p.pmoRows || {}), ...(p.actuals || {}), ...(p.forecast || {}) }
            : ((p[targetKey] && Object.keys(p[targetKey]).length > 0) ? p[targetKey] : (mode === 'Budget' ? (p.pmoRows || {}) : {}));
        
        // Prepare mode-specific data to ensure they are always present and normalized
        const pmoRows = p.pmoRows || {};
        const actuals = p.actuals || {};
        const forecast = p.forecast || {};
        
        let manpowerSpent = 0;
        let expenseSpent = 0;
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        const isAllFY = fyStrings.includes('All FY');
        const startYears = fyStrings.map(fy => {
          const match = fy.match(/\d+/);
          return (match && match[0]) ? parseInt(match[0]) : 25;
        });
        const minYear = Math.min(...startYears);
        const maxYear = Math.max(...startYears);
        const yearOffset = isAllFY ? 0 : (minYear - 19) * 12;
        const yearLimit = isAllFY ? MAX_MONTHS : (maxYear - minYear + 1) * 12;

        const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
        for (let i = 0; i < MAX_MONTHS; i++) {
          const startYearVal = 19 + Math.floor(i / 12);
          const fyStrVal = `FY ${startYearVal}-${startYearVal + 1}`;
          const fyConfigVal = masterConfig.fyFinancials?.[fyStrVal];
          ratesCache[i] = {
            hRate: (fyConfigVal?.hourlyRate !== undefined && fyConfigVal?.hourlyRate !== null) ? fyConfigVal.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
            cRate: (fyConfigVal?.contractedEmployeeRate !== undefined && fyConfigVal?.contractedEmployeeRate !== null) ? fyConfigVal.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
          };
        }

        let monthlyFTEs = new Array(MAX_MONTHS).fill(0);
        let monthlyActuals = new Array(MAX_MONTHS).fill(0);
        let skills: Record<string, number[]> = {};
        let expenses: Record<string, number[]> = {};

        Object.entries(data).forEach(([rawCat, months]: [string, any]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          const isContracted = cat === 'Contracted Employee';
          const isContractedExp = cat === 'Contracted Employee Expense';
          const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || isContracted;
          const isExpense = EXPENSE_CATEGORIES.includes(cat as any) || isContractedExp;
          const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
          
          const monthArray = new Array(MAX_MONTHS).fill(0);
          if (Array.isArray(months)) {
            months.forEach((v, i) => {
              if (i >= 0 && i < MAX_MONTHS) {
                monthArray[i] = v;
              }
            });
          } else if (months && typeof months === 'object') {
            Object.entries(months).forEach(([idxStr, v]) => {
              const idx = parseInt(idxStr);
              if (idx >= 0 && idx < MAX_MONTHS) {
                monthArray[idx] = v as number;
              }
            });
          }

          const hpm = 180; // Standardized to 180

          if (isManpower) {
            skills[cat] = monthArray;
            monthArray.forEach((v, i) => {
              const currentFyIdx = Math.floor(i / 12);
              const currentFyStart = 19 + currentFyIdx;
              const currentFyStr = `FY ${currentFyStart}-${currentFyStart + 1}`;
              const isSelectedMonth = isAllFY || fyStrings.includes(currentFyStr as any);

              if (isSelectedMonth) {
                monthlyFTEs[i] += v;
                const { hRate, cRate } = ratesCache[i];
                if (isContracted) {
                  const cost = v * cRate * hpm;
                  if (!expenses['Contracted Employee Expense']) expenses['Contracted Employee Expense'] = new Array(MAX_MONTHS).fill(0);
                  expenses['Contracted Employee Expense'][i] += cost;
                  monthlyActuals[i] += cost;
                  manpowerSpent += cost;
                } else {
                  const cost = v * hRate * hpm;
                  if (!isHolidayLeave) {
                    monthlyActuals[i] += cost;
                    manpowerSpent += cost;
                  }
                }
              }
            });
          } else if (isExpense) {
            expenses[cat] = monthArray;
            monthArray.forEach((v, i) => {
              const currentFyIdx = Math.floor(i / 12);
              const currentFyStart = 19 + currentFyIdx;
              const currentFyStr = `FY ${currentFyStart}-${currentFyStart + 1}`;
              const isSelectedMonth = isAllFY || fyStrings.includes(currentFyStr as any);

              if (isSelectedMonth) {
                if (isContractedExp) {
                  // Avoid double counting: only add if there's no manpower for this month
                  const mmVal = (skills['Contracted Employee'] || [])[i] || 0;
                  if (mmVal === 0) {
                    monthlyActuals[i] += v;
                    manpowerSpent += v;
                  }
                } else {
                  expenseSpent += v;
                  monthlyActuals[i] += v;
                }
              }
            });
          }
        });

        let totalBudgetExpense = 0;
        const hpmVal = 180; // Standardized to 180

        const budgetSource = p.pmoRows || {};
        
        const getArr = (data: any) => {
          if (!data) return new Array(MAX_MONTHS).fill(0);
          if (Array.isArray(data)) return data;
          const arr = new Array(MAX_MONTHS).fill(0);
          Object.entries(data).forEach(([k, v]) => {
            const idx = parseInt(k);
            if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) arr[idx] = typeof v === 'number' ? v : 0;
          });
          return arr;
        };

        const isHolidayLeaveVal = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');

        Object.entries(budgetSource).forEach(([rawCat, months]: [string, any]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          const isContracted = cat === 'Contracted Employee';
          const isContractedExp = cat === 'Contracted Employee Expense';
          const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || isContracted;
          const isExpense = EXPENSE_CATEGORIES.includes(cat as any) || isContractedExp;
          
          const arr = getArr(months);
          for (let i = 0; i < MAX_MONTHS; i++) {
            const currentFyIdx = Math.floor(i / 12);
            const currentFyStart = 19 + currentFyIdx;
            const currentFyStr = `FY ${currentFyStart}-${currentFyStart + 1}`;
            const isSelectedMonth = isAllFY || fyStrings.includes(currentFyStr as any);

            if (!isSelectedMonth) continue;

            const v = arr[i] || 0;
            if (v === 0) continue;
            
            const { hRate, cRate } = ratesCache[i];
            if (isManpower) {
              if (isContracted) {
                totalBudgetExpense += v * cRate * hpmVal;
              } else if (!isHolidayLeaveVal) {
                totalBudgetExpense += v * hRate * hpmVal;
              }
            } else if (isExpense) {
              if (isContractedExp) {
                const mmArr = getArr(budgetSource['Contracted Employee'] || budgetSource['Contracted Employee (MM)']);
                const mmVal = mmArr[i] || 0;
                if (mmVal === 0) {
                  totalBudgetExpense += v;
                }
              } else if (!isHolidayLeaveVal) {
                totalBudgetExpense += v;
              }
            }
          }
        });

        const actualSpent = manpowerSpent + expenseSpent;
        const portfolioBudgetCr = totalBudgetExpense;
        const actualSpentCr = actualSpent;
        const manpowerSpentCr = manpowerSpent;
        const expenseSpentCr = expenseSpent;

        const totalMM = monthlyFTEs.reduce((a, b) => a + b, 0);

        return {
          code: p.code,
          name: p.name,
          actualSpent,
          manpowerSpent,
          expenseSpent,
          portfolioBudgetCr,
          actualSpentCr,
          manpowerSpentCr,
          expenseSpentCr,
          totalMM,
          monthlyFTEs,
          monthlyActuals,
          skills,
          expenses,
          rows: skills,
          pmoRows,
          actuals,
          forecast,
          tbc: p.tbc || 'Yes',
          vertical: p.vertical || 'SUPPORT',
          category: p.category || 'NPC',
          productFamily: p.productFamily || 'SUPPORT',
          pace: p.pace || '-',
          buDomain: p.buDomain || 'NA',
          businessUnit: p.businessUnit || 'NA',
          projectType: p.projectType || 'NA',
          pdh: p.pdh || 'NA',
          customer: p.customer || '',
          segment: p.segment || 'NA',
          sopMonth: p.sopMonth || '',
          sopFyYear: p.sopFyYear || '',
          currentGate: p.currentGate || '',
          forecastMonths: p.forecastMonths || 0,
          prevYearBudget: p.prevYearBudget || 0,
          expenseTillMar26: p.expenseTillMar26 || 0,
          isLocked: p.isLocked || false,
          remaining: portfolioBudgetCr - actualSpentCr,
          burnRate: portfolioBudgetCr > 0 ? (actualSpentCr / portfolioBudgetCr) * 100 : 0,
          status: p.status,
          importErrors: p.errors,
          employeeSkills: p.employeeSkills || {},
          actualsEmployeeSkills: p.actualsEmployeeSkills || {},
          forecastEmployeeSkills: p.forecastEmployeeSkills || {},
          employeeBillableHours: p.employeeBillableHours || {},
          employeeNonBillableHours: p.employeeNonBillableHours || {},
          employeeIdleHours: p.employeeIdleHours || {},
          employeeInfo: p.employeeInfo || {},
          generation: p.generation || 'Current'
        };
      });

      const filteredResults = baseResults.filter((p: any) => {
        const searchStr = filters.search.toLowerCase().trim();
        if (searchStr && !(p.code || '').toLowerCase().includes(searchStr) && !(p.name || '').toLowerCase().includes(searchStr)) return false;
        if (!filters.projectId.includes('All') && !filters.projectId.includes(p.code)) return false;
        if (!filters.vertical.includes('All') && !filters.vertical.includes(p.vertical)) return false;
        if (!filters.domain.includes('All') && !filters.domain.includes(p.buDomain)) return false;
        if (!filters.bu.includes('All') && !filters.bu.includes(p.businessUnit)) return false;
        if (!filters.customer.includes('All') && !filters.customer.includes(p.customer)) return false;
        if (!filters.projectType.includes('All') && !filters.projectType.includes(p.projectType)) return false;
        if (!filters.family.includes('All') && !filters.family.includes(p.productFamily)) return false;
        if (!filters.category.includes('All') && !filters.category.includes(p.category)) return false;
        if (!filters.tbc.includes('All') && !filters.tbc.map(v => v.toLowerCase()).includes((p.tbc || 'Yes').toLowerCase())) return false;
        if (!filters.pdh.includes('All') && !filters.pdh.includes(p.pdh)) return false;
        if (!filters.generation.includes('All') && !filters.generation.includes(p.generation || 'Current')) return false;
        return true;
      });

      return { results: filteredResults, unfiltered: baseResults, metadata: { processedCount: filteredResults.length, dateErrorCount: 0, fyMismatchCount: 0, totalRows: processedImportData.projects.length } };
    }

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      const fy = selectedFY || DEFAULT_FY;
      const fyConfig = masterConfig.fyFinancials?.[fy];
      const fyFinancials = { 
        hourlyRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR), 
        hoursPerMonth: 180,
        contractedEmployeeRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
      };
      const hourlyRate = fyFinancials.hourlyRate;
      const hpm = fyFinancials.hoursPerMonth;

      const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
      const isAllFY = fyStrings.includes('All FY');
      const startYears = fyStrings.map(fy => {
        const match = fy.match(/\d+/);
        return (match && match[0]) ? parseInt(match[0]) : 25;
      });
      const minYear = Math.min(...startYears);
      const maxYear = Math.max(...startYears);
      const yearOffset = isAllFY ? 0 : (minYear - 19) * 12;
      const yearLimit = isAllFY ? MAX_MONTHS : (maxYear - minYear + 1) * 12;

      const filteredExisting = existingProjects.filter(p => {
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        const isAllFY = fyStrings.includes('All FY');
        const hasTagInScope = isAllFY || fyStrings.some(fy => 
          (p.budgetFYs || []).includes(fy) || 
          (p.actualsFYs || []).includes(fy) || 
          (p.forecastFYs || []).includes(fy) ||
          p.fiscalYear === fy
        );
        
        // In analytics view we want all projects with data in any selected mode to be visible
        const dataKeys = (activeTab === 'analytics') 
          ? ['actuals', 'pmoRows', 'forecast'] 
          : [mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows')];
          
        let hasDataInScope = false;
        
        // Map target years to accurate month ranges
        const validMonthIndices = new Set<number>();
        if (isAllFY) {
            for(let i=0; i<MAX_MONTHS; i++) validMonthIndices.add(i);
        } else {
            fyStrings.forEach(fy => {
                const match = fy.match(/\d+/);
                const sYear = (match && match[0]) ? parseInt(match[0]) : 25;
                const offset = (sYear - 19) * 12;
                for(let i = offset; i < offset + 12; i++) {
                    validMonthIndices.add(i);
                }
            });
        }
        
        dataKeys.forEach(dk => {
          const dataSource = p[dk] || {};
          Object.values(dataSource).forEach((data: any) => {
            if (Array.isArray(data)) {
              data.forEach((v, i) => {
                if (validMonthIndices.has(i) && v > 0) hasDataInScope = true;
              });
            } else if (data && typeof data === 'object') {
              Object.entries(data).forEach(([k, v]) => {
                const idx = parseInt(k);
                if (!isNaN(idx) && validMonthIndices.has(idx) && (v as number) > 0) {
                  hasDataInScope = true;
                }
              });
            }
          });
        });

        // LOOSENED: Show all projects tagged for this FY even if they have no data for current mode yet
        return hasTagInScope || hasDataInScope;
      });

      const fyStringsInner = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
      const isAllFYInner = fyStringsInner.includes('All FY');

      let combinedProjects = [...filteredExisting];
      
      // Preserve all existing/imported projects (e.g. UMD-4322) even if not registered in Master Projects yet

      if (mode === 'Budget' || mode === 'Forecast' || activeTab === 'analytics') {
          const applicableMaster = masterProjects.filter(mp => 
              isAllFYInner || fyStringsInner.some(fy => (mp.applicableFYs || []).includes(fy as any))
          ).map(mp => ({
              ...mp,
              rows: {},
              pmoRows: {},
              actuals: {},
              forecast: {},
              budgetFYs: mp.applicableFYs,
              forecastFYs: mp.applicableFYs,
              actualsFYs: mp.applicableFYs,
              isLocked: false,
              isMaster: true,
              tbc: mp.tbc || 'Yes',
              timelineOffset: mp.timelineOffset || 0,
              igGates: mp.igGates || [],
              remarks: [],
              rowRemarks: {},
              seenMonths: new Set<number>()
          })) as any as ProjectData[];

          const existingCodes = new Set(filteredExisting.map(p => (p.code || '').trim().toUpperCase()));
          applicableMaster.forEach(mp => {
              const code = (mp.code || '').trim().toUpperCase();
              if (code && !existingCodes.has(code)) {
                  combinedProjects.push(mp);
              }
          });
      }

      const baseResults = combinedProjects.map(p => {
        // Calculate totals for display
        const calcModeTotals = (sourceKey: 'pmoRows' | 'actuals' | 'forecast') => {
          let mm = 0, manInr = 0, expInr = 0;
          const hpm = 180;
          const isHolidayLeaveProject = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');

          // Pre-calculate rates for ALL possibly selected months to handle multi-year
          const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
          for (let i = 0; i < MAX_MONTHS; i++) {
            const startYear = 19 + Math.floor(i / 12);
            const fyStr = `FY ${startYear}-${startYear + 1}`;
            const fyConfig = masterConfig.fyFinancials?.[fyStr];
            ratesCache[i] = {
              hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
              cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
            };
          }

          // Gather all categories across all sources for this project to ensure none are missed
          const allCategories = new Set<string>([
            ...MANPOWER_CATEGORIES,
            ...EXPENSE_CATEGORIES,
            ...Object.keys(p.pmoRows || {}),
            ...Object.keys(p.rows || {}),
            ...Object.keys(p.actuals || {}),
            ...Object.keys(p.forecast || {}),
            ...Object.keys(p.skills || {}),
            ...Object.keys(p.expenses || {}),
            ...Object.keys(p.employeeSkills || {}),
            ...Object.keys(p.actualsEmployeeSkills || {}),
            ...Object.keys(p.forecastEmployeeSkills || {})
          ]);

          allCategories.forEach(rawCat => {
            const cat = SKILL_MAPPING[rawCat] || rawCat;
            const isContracted = cat === 'Contracted Employee';
            const isContractedExp = cat === 'Contracted Employee Expense';
            const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || isContracted;
            const isExpense = EXPENSE_CATEGORIES.includes(cat as any) || isContractedExp;

            const monthsArray = getAuthoritativeRowUI(p as any, rawCat, sourceKey);

            for (let i = 0; i < MAX_MONTHS; i++) {
              const fIdx = Math.floor(i / 12);
              const fYear = 19 + fIdx;
              const fStr = `FY ${fYear}-${fYear + 1}`;
              const isSelectedMonth = isAllFY || fyStrings.includes(fStr as any);
              
              if (!isSelectedMonth) continue;

              const v = Number(monthsArray[i]) || 0;
              if (v === 0) continue;

              const { hRate, cRate } = ratesCache[i];

              if (isManpower) {
                mm += v;
                if (isContracted) {
                  manInr += v * cRate * hpm;
                 } else if (!isHolidayLeaveProject) {
                  manInr += v * hRate * hpm;
                }
              } else if (isExpense) {
                if (isContractedExp) {
                  const mmVal = Number(getAuthoritativeRowUI(p as any, 'Contracted Employee', sourceKey)[i]) || 0;
                  if (mmVal === 0) {
                    manInr += v;
                  }
                } else if (!isHolidayLeaveProject) {
                  expInr += v;
                }
              }
            }
          });

          const expCr = Math.abs(expInr) > 1000 ? expInr / 10000000 : expInr;
          const totalCr = (manInr / 10000000) + expCr;
          const manCr = manInr / 10000000;
          return { mm, manpowerCr: manCr, expensesCr: expCr, totalCr };
        };

        const budgetTotals = calcModeTotals('pmoRows');
        const currentTotals = mode === 'Actuals' ? calcModeTotals('actuals') : (mode === 'Forecast' ? calcModeTotals('forecast') : budgetTotals);

        const isFixedMode = (p.budgetMode || 'detailed') === 'fixed';
        const finalPortfolioBudgetCr = isFixedMode ? (p.portfolioBudgetCr || 0) : budgetTotals.totalCr;

        return {
          ...p,
          pmoRows: p.pmoRows || {},
          actuals: p.actuals || {},
          forecast: p.forecast || {},
          actualSpent: currentTotals.totalCr * 10000000,
          manpowerSpent: currentTotals.manpowerCr * 10000000,
          expenseSpent: currentTotals.expensesCr * 10000000,
          portfolioBudgetCr: finalPortfolioBudgetCr,
          actualSpentCr: currentTotals.totalCr,
          manpowerSpentCr: currentTotals.manpowerCr,
          expenseSpentCr: currentTotals.expensesCr,
          remaining: finalPortfolioBudgetCr - currentTotals.totalCr,
          totalMM: currentTotals.mm,
          burnRate: finalPortfolioBudgetCr > 0 ? (currentTotals.totalCr / finalPortfolioBudgetCr) * 100 : 0
        };
      });

      const filteredResults = baseResults.filter(p => {
        const searchStr = filters.search.toLowerCase().trim();
        if (searchStr && !(p.code || '').toLowerCase().includes(searchStr) && !(p.name || '').toLowerCase().includes(searchStr)) return false;
        if (!filters.projectId.includes('All') && !filters.projectId.includes(p.code)) return false;
        if (!filters.vertical.includes('All') && !filters.vertical.includes(p.vertical)) return false;
        if (!filters.domain.includes('All') && !filters.domain.includes(p.buDomain)) return false;
        if (!filters.bu.includes('All') && !filters.bu.includes(p.businessUnit)) return false;
        if (!filters.customer.includes('All') && !filters.customer.includes(p.customer)) return false;
        if (!filters.projectType.includes('All') && !filters.projectType.includes(p.projectType)) return false;
        if (!filters.family.includes('All') && !filters.family.includes(p.productFamily)) return false;
        if (!filters.category.includes('All') && !filters.category.includes(p.category)) return false;
        if (!filters.tbc.includes('All') && !filters.tbc.map(v => v.toLowerCase()).includes((p.tbc || 'Yes').toLowerCase())) return false;
        if (!filters.pdh.includes('All') && !filters.pdh.includes(p.pdh)) return false;
        if (!filters.generation.includes('All') && !filters.generation.includes(p.generation || 'Current')) return false;
        return true;
      });

      return { results: filteredResults, unfiltered: baseResults, metadata: { processedCount: filteredResults.length, dateErrorCount: 0, fyMismatchCount: 0, totalRows: existingProjects.length } };
    }

    const { results: baseResultsWithRaw, metadata } = processRawData(rawData, selectedFYs, masterConfig, mode, existingProjects, masterEmployees);

    // Merge master projects that are NOT in the raw data results
    let baseResults = [...baseResultsWithRaw];

    const fyStringsOuter = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFYOuter = fyStringsOuter.includes('All FY');

    if (mode === 'Budget' || mode === 'Forecast' || activeTab === 'analytics') {
      const existingCodes = new Set(baseResultsWithRaw.map(p => (p.code || '').trim().toUpperCase()));
      const applicableMaster = masterProjects.filter(mp => 
          isAllFYOuter || fyStringsOuter.some(fy => (mp.applicableFYs || []).includes(fy as any))
      ).map(mp => ({
          ...mp,
          rows: {},
          pmoRows: {},
          actuals: {},
          forecast: {},
          budgetFYs: mp.applicableFYs,
          forecastFYs: mp.applicableFYs,
          actualsFYs: mp.applicableFYs,
          isLocked: false,
          isMaster: true,
          tbc: mp.tbc || 'Yes',
          timelineOffset: mp.timelineOffset || 0,
          igGates: mp.igGates || [],
          remarks: [],
          rowRemarks: {},
          seenMonths: new Set<number>()
      })) as any as ProcessedProject[];

      applicableMaster.forEach(mp => {
        const code = (mp.code || '').trim().toUpperCase();
        if (code && !existingCodes.has(code)) {
          // Initialize derived fields for the list view
          const mappedMp: ProcessedProject = {
            ...mp,
            actualSpent: 0,
            manpowerSpent: 0,
            expenseSpent: 0,
            portfolioBudgetCr: 0,
            actualSpentCr: 0,
            manpowerSpentCr: 0,
            expenseSpentCr: 0,
            remaining: 0,
            totalMM: 0,
            burnRate: 0,
            seenMonths: new Set<number>(),
            monthlyFTEs: new Array(MAX_MONTHS).fill(0),
            monthlyActuals: new Array(MAX_MONTHS).fill(0),
          };
          baseResults.push(mappedMp as any);
        }
      });
    }

    const filteredResults = baseResults.filter((p: any) => {
      const searchStr = filters.search.toLowerCase().trim();
      if (searchStr && !(p.code || '').toLowerCase().includes(searchStr) && !(p.name || '').toLowerCase().includes(searchStr)) return false;
      if (!filters.projectId.includes('All') && !filters.projectId.includes(p.code)) return false;
      if (!filters.vertical.includes('All') && !filters.vertical.includes(p.vertical)) return false;
      if (!filters.domain.includes('All') && !filters.domain.includes(p.buDomain)) return false;
      if (!filters.bu.includes('All') && !filters.bu.includes(p.businessUnit)) return false;
      if (!filters.customer.includes('All') && !filters.customer.includes(p.customer)) return false;
      if (!filters.projectType.includes('All') && !filters.projectType.includes(p.projectType)) return false;
      if (!filters.family.includes('All') && !filters.family.includes(p.productFamily)) return false;
      if (!filters.category.includes('All') && !filters.category.includes(p.category)) return false;
      if (!filters.tbc.includes('All') && !filters.tbc.map(v => v.toLowerCase()).includes((p.tbc || 'Yes').toLowerCase())) return false;
      if (!filters.pdh.includes('All') && !filters.pdh.includes(p.pdh)) return false;
      if (!filters.generation.includes('All') && !filters.generation.includes(p.generation || 'Current')) return false;
      return true;
    });

    return { results: filteredResults, unfiltered: baseResults, metadata };
  }, [rawData, existingProjects, masterProjects, filters, selectedFYs, importType, processedImportData, mode, masterConfig, renderKey, activeTab, lastUpdated]);

  const budgetProcessedProjects = useMemo(() => {
    const budgetOnlyProjects = existingProjects.map(p => ({
      ...p,
      forecast: {},
      actuals: {}
    }));
    return processRawData(rawData, selectedFYs, masterConfig, 'Budget', budgetOnlyProjects, masterEmployees);
  }, [rawData, selectedFYs, masterConfig, existingProjects, lastUpdated]);

  const pmoEmployees = useMemo(() => {
    const empMap: Record<string, Employee> = {};
    
    // Initialize with master employees
    (masterEmployees || []).forEach(emp => {
      const key = (emp.email || emp.id || '').toLowerCase();
      if (key) {
        empMap[key] = { ...emp };
      }
    });

    (processedProjects.results || []).forEach(p => {
      Object.entries(p.employeeInfo || {}).forEach(([email, info]) => {
        const infoAny = info as any;
        const emailLower = email.toLowerCase();
        
        // Try to find skill from employeeSkills if missing
        let derivedSkill = infoAny.skill;
        let derivedSkillLevel2 = infoAny.skillLevel2;
        
        if (!derivedSkill || derivedSkill === 'Unknown') {
          for (const [skillName, employeesInSkill] of Object.entries(p.employeeSkills || {})) {
            if (employeesInSkill[email]) {
              derivedSkill = skillName;
              derivedSkillLevel2 = skillName; // Fallback
              break;
            }
          }
        }

        if (!empMap[emailLower]) {
          empMap[emailLower] = { 
            ...infoAny, 
            email: emailLower, 
            id: emailLower, 
            empId: infoAny.empId || 'Unknown',
            name: infoAny.name || 'Unknown',
            band: infoAny.band || 'Unknown',
            vertical: infoAny.vertical || 'Unknown',
            category: infoAny.category || 'Unknown',
            location: infoAny.location || 'Unknown',
            skill: derivedSkill || 'Unknown',
            skillLevel2: derivedSkillLevel2 || 'Unknown',
            productFamily: infoAny.productFamily || 'Unknown'
          };
        } else {
          if ((empMap[emailLower].name === 'Unknown' || !empMap[emailLower].name) && infoAny.name) {
            empMap[emailLower].name = infoAny.name;
          }
          if ((empMap[emailLower].empId === 'Unknown' || !empMap[emailLower].empId) && infoAny.empId) {
            empMap[emailLower].empId = infoAny.empId;
          }
          if ((empMap[emailLower].skill === 'Unknown' || !empMap[emailLower].skill) && derivedSkill && derivedSkill !== 'Unknown') {
            empMap[emailLower].skill = derivedSkill;
            empMap[emailLower].skillLevel2 = derivedSkillLevel2 || derivedSkill;
          }
        }
      });
    });
    return Object.values(empMap);
  }, [processedProjects, masterEmployees]);

  const dynamicOptions = useMemo(() => {
    const options: any = {
      projectId: ['All'],
      domain: ['All'],
      bu: ['All'],
      customer: ['All'],
      projectType: ['All'],
      family: ['All'],
      category: ['All'],
      tbc: ['All', 'Yes', 'No'],
      pdh: ['All'],
      generation: ['All']
    };

    // Use UNFILTERED results to populate dropdowns, so we always see all options for the FY
    (processedProjects.unfiltered || []).forEach(p => {
      if (p.code && !options.projectId.includes(p.code)) options.projectId.push(p.code);
      if (p.buDomain && !options.domain.includes(p.buDomain)) options.domain.push(p.buDomain);
      if (p.businessUnit && !options.bu.includes(p.businessUnit)) options.bu.push(p.businessUnit);
      if (p.customer && !options.customer.includes(p.customer)) options.customer.push(p.customer);
      if (p.projectType && !options.projectType.includes(p.projectType)) options.projectType.push(p.projectType);
      if (p.productFamily && !options.family.includes(p.productFamily)) options.family.push(p.productFamily);
      if (p.category && !options.category.includes(p.category)) options.category.push(p.category);
      if (p.pdh && !options.pdh.includes(p.pdh)) options.pdh.push(p.pdh);
      if (p.generation && !options.generation.includes(p.generation)) options.generation.push(p.generation);
    });

    Object.keys(options).forEach(key => {
      if (Array.isArray(options[key])) {
        const allIndex = options[key].indexOf('All');
        const rest = options[key].filter((v: any) => v !== 'All').sort();
        options[key] = allIndex !== -1 ? ['All', ...rest] : rest;
      }
    });

    return options;
  }, [processedProjects.unfiltered]);

  const stats = useMemo(() => {
    let baseEffortsMM = 0, baseManpowerCr = 0, baseExpensesCr = 0, baseNewCr = 0, baseCoCr = 0, baseTotalCr = 0;
    let confirmedTotalCr = 0, portfolioTotalCr = 0;
    let confirmedCount = 0;
    let portfolioCount = (processedProjects.results || []).length;

    (processedProjects.results || []).forEach(p => {
      console.log("Analyzing project for stats:", p.name, p.code, mode, mode === 'Budget' ? p.portfolioBudgetCr : p.actualSpentCr);
      const spentCr = mode === 'Budget' ? (p.portfolioBudgetCr || 0) : (p.actualSpentCr || 0);
      const manpowerSpentCr = mode === 'Budget' ? (p.manpowerSpentCr || 0) : (p.manpowerSpentCr || 0); 
      const expenseSpentCr = mode === 'Budget' ? (p.expenseSpentCr || 0) : (p.expenseSpentCr || 0);

      portfolioTotalCr += spentCr;
      
      baseEffortsMM += p.totalMM || 0;
      baseManpowerCr += manpowerSpentCr;
      baseExpensesCr += expenseSpentCr;
      baseTotalCr += spentCr;
      
      if (isNew(p.category)) baseNewCr += spentCr;
      else if (isCO(p.category)) baseCoCr += spentCr;

      if (isConfirmedProject(p)) {
        confirmedCount++;
        confirmedTotalCr += spentCr;
      }
    });

    return { 
      confirmedCount, 
      portfolioCount, 
      baseEffortsMM, 
      baseManpowerCr, 
      baseExpensesCr, 
      baseNewCr, 
      baseCoCr, 
      baseTotalCr, 
      confirmedTotalCr,
      portfolioTotalCr,
      consolidatedTotalCr: portfolioTotalCr 
    };
  }, [processedProjects, mode]);

  const handleUpdateProject = (projectCode: string, field: string, value: any, fullProject: any) => {
    console.log('Update Project:', projectCode, field, value);
    setProjects(prev => {
      const targetCode = (projectCode || '').trim().toUpperCase();
      const existingIdx = prev.findIndex(p => (p.code || '').trim().toUpperCase() === targetCode);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], [field]: value };
        return updated;
      } else {
        const fyTagKey = mode === 'Actuals' ? 'actualsFYs' : (mode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        const newProject: ProjectData = {
          id: projectCode,
          code: projectCode,
          name: fullProject.name || '',
          vertical: fullProject.vertical || 'SUPPORT',
          category: fullProject.category || 'NPC',
          tbc: fullProject.tbc || 'Yes',
          status: fullProject.status || 'Active',
          buDomain: fullProject.buDomain || 'NA',
          businessUnit: fullProject.businessUnit || 'NA',
          projectType: fullProject.projectType || 'NA',
          productFamily: fullProject.productFamily || 'SUPPORT',
          pace: fullProject.pace || '-',
          segment: fullProject.segment || 'NA',
          timelineOffset: 0,
          igGates: [],
          rows: {},
          pmoRows: {},
          actuals: {},
          forecast: {},
          budgetFYs: [],
          actualsFYs: [],
          forecastFYs: [],
          [fyTagKey]: fyStrings.includes('All FY') ? [DEFAULT_FY] : fyStrings,
          [field]: value
        };
        return [...prev, newProject];
      }
    });
    triggerLocalUpdate();
  };

  const handleUpdateEstimation = (projectCode: string, category: string, monthIndex: number, value: number, type: 'manpower' | 'expense', modeOverride?: FiscalMode) => {
    const updateMode = modeOverride || mode;
    console.log('handleUpdateEstimation called', { projectCode, category, monthIndex, value, type, updateMode });
    setProjects(prev => {
      const targetCode = (projectCode || '').trim().toUpperCase();
      const existingIdx = prev.findIndex(p => (p.code || '').trim().toUpperCase() === targetCode);
      
      let p: ProjectData;
      let updated = [...prev];
      let pIdx = existingIdx;
      
      if (existingIdx !== -1) {
        p = updated[existingIdx];
      } else {
        const fullProject = (masterProjects || []).find(mp => (mp.code || '').trim().toUpperCase() === targetCode);
        if (!fullProject) return prev;
        const fyTagKey = updateMode === 'Actuals' ? 'actualsFYs' : (updateMode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        p = {
          id: projectCode,
          code: projectCode,
          name: fullProject.name || '',
          vertical: fullProject.vertical || 'SUPPORT',
          category: fullProject.category || 'NPC',
          tbc: fullProject.tbc || 'Yes',
          status: fullProject.status || 'Active',
          buDomain: fullProject.buDomain || 'NA',
          businessUnit: fullProject.businessUnit || 'NA',
          projectType: fullProject.projectType || 'NA',
          productFamily: fullProject.productFamily || 'SUPPORT',
          pace: fullProject.pace || '-',
          segment: fullProject.segment || 'NA',
          timelineOffset: 0,
          igGates: [],
          rows: {},
          pmoRows: {},
          actuals: {},
          forecast: {},
          budgetFYs: [],
          actualsFYs: [],
          forecastFYs: [],
          [fyTagKey]: fyStrings.includes('All FY') ? ['FY 25-26'] : fyStrings
        };
        updated.push(p);
        pIdx = updated.length - 1;
      }
        
      const fy = (p as any).fiscalYear || (Array.isArray(selectedFYs) ? (selectedFYs[0] === 'All FY' ? 'FY 25-26' : selectedFYs[0]) : selectedFYs);
      const fyConfig = masterConfig.fyFinancials?.[fy];
      const hourlyRate = (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR);
      const contractedRate = (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE);
      const hpm = 180;

      const targetKey = updateMode === 'Actuals' ? 'actuals' : (updateMode === 'Forecast' ? 'forecast' : 'pmoRows');
      const hasTargetData = p[targetKey] && Object.keys(p[targetKey] || {}).length > 0;
      const isBudgetMode = updateMode === 'Budget' || updateMode === 'PMO_Budget';
      
      const newRows = hasTargetData 
        ? { ...(p[targetKey] || {}) } 
        : (isBudgetMode ? { ...(p.pmoRows || {}) } : {});

      if (type === 'manpower') {
        const existingRow = newRows[category] || new Array(MAX_MONTHS).fill(0);
        const rowArray = ensureArray(existingRow, MAX_MONTHS);
        newRows[category] = [...rowArray];
        const globalIdx = monthIndices[monthIndex];
        newRows[category][globalIdx] = value; 
        
        let newManpowerSpent = 0;
        let newMonthlyFTEs = new Array(MAX_MONTHS).fill(0);
        Object.entries(newRows).forEach(([cat, row]: [string, any]) => {
          if (!MANPOWER_CATEGORIES.includes(cat as any) && cat !== 'Contracted Employee') return;
          const arr = ensureArray(row, MAX_MONTHS);
          const isContracted = cat === 'Contracted Employee';
          arr.forEach((val: number, idx: number) => {
            const mm = val || 0;
            newMonthlyFTEs[idx] += mm;
            if (!isContracted) {
              newManpowerSpent += mm * hourlyRate * hpm;
            }
          });
        });
        
        let newExpenseSpent = 0;
        let newMonthlyExpenses = new Array(MAX_MONTHS).fill(0);
        const contractedExp = new Array(MAX_MONTHS).fill(0);
        
        Object.entries(newRows).forEach(([cat, row]: [string, any]) => {
          if (!EXPENSE_CATEGORIES.includes(cat as any)) return;
          const arr = ensureArray(row, MAX_MONTHS);
          const isContractedMM = cat === 'Contracted Employee';
          arr.forEach((val: number, idx: number) => {
            if (isContractedMM) {
              const cost = (val || 0) * contractedRate * hpm;
              newMonthlyExpenses[idx] += cost;
              newExpenseSpent += cost;
              contractedExp[idx] += cost;
            } else if (cat !== 'Contracted Employee Expense') {
              newMonthlyExpenses[idx] += (val || 0);
              newExpenseSpent += (val || 0);
            }
          });
        });
        
        newRows['Contracted Employee Expense'] = contractedExp;
        
        updated[pIdx] = { 
          ...p, 
          [targetKey]: newRows,
          monthlyFTEs: newMonthlyFTEs,
          monthlyExpenses: newMonthlyExpenses,
          manpowerSpent: newManpowerSpent,
          manpowerSpentCr: newManpowerSpent,
          expenseSpent: newExpenseSpent,
          expenseSpentCr: newExpenseSpent,
          actualSpent: newManpowerSpent + newExpenseSpent,
          actualSpentCr: (newManpowerSpent + newExpenseSpent)
        };
      } else {
        const existingExp = newRows[category] || new Array(MAX_MONTHS).fill(0);
        const expArray = ensureArray(existingExp, MAX_MONTHS);
        newRows[category] = [...expArray];
        const globalIdx = monthIndices[monthIndex];
        newRows[category][globalIdx] = value;
        
        let expenseSpent = 0;
        let newMonthlyExpenses = new Array(MAX_MONTHS).fill(0);
        Object.entries(newRows).forEach(([cat, row]: [string, any]) => {
          if (!EXPENSE_CATEGORIES.includes(cat as any)) return;
          const isContractedMM = cat === 'Contracted Employee';
          const arr = ensureArray(row, MAX_MONTHS);
          arr.forEach((val: number, idx: number) => {
            if (isContractedMM) {
              const cost = (val || 0) * contractedRate * hpm;
              newMonthlyExpenses[idx] += cost;
              expenseSpent += cost;
            } else if (cat !== 'Contracted Employee Expense') {
              newMonthlyExpenses[idx] += (val || 0);
              expenseSpent += (val || 0);
            }
          });
        });

        updated[pIdx] = { 
          ...p, 
          [targetKey]: newRows,
          monthlyExpenses: newMonthlyExpenses,
          expenseSpent: expenseSpent,
          expenseSpentCr: expenseSpent,
          actualSpent: p.manpowerSpent + expenseSpent,
          actualSpentCr: (p.manpowerSpent + expenseSpent)
        };
      }
      return updated;
    });
    triggerLocalUpdate();
  };

  const handleUpdateResourceAllocation = (
    projectCode: string, 
    skill: string, 
    email: string, 
    monthlyAllocs: number[], 
    empInfo: { name: string; email: string; skill?: string; category?: string }
  ) => {
    setProjects(prev => {
      const targetCode = (projectCode || '').trim().toUpperCase();
      const existingIdx = prev.findIndex(p => (p.code || '').trim().toUpperCase() === targetCode);
      
      let p: ProjectData;
      let updated = [...prev];
      let pIdx = existingIdx;
      
      if (existingIdx !== -1) {
        p = { ...updated[existingIdx] };
        if (isResourceAllocationLockedForProject(p)) return prev;
      } else {
        const fullProject = (masterProjects || []).find(mp => (mp.code || '').trim().toUpperCase() === targetCode);
        if (!fullProject) return prev;
        
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        const targetFY = fyStrings[0] || 'FY 25-26';
        if (masterConfig.isFiscalLocked || 
            !!masterConfig.fiscalLocks?.[`pmo_page_${targetFY}_master`] || 
            !!masterConfig.fiscalLocks?.[`pmo_page_${targetFY}_Budget`] || 
            !!masterConfig.fiscalLocks?.[`pmo_page_${targetFY}_Forecast`]) {
          return prev;
        }
        
        // Use logic from handleUpdateEstimation to create new project entry
        const fyTagKey = mode === 'Actuals' ? 'actualsFYs' : (mode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
        
        p = {
          id: projectCode,
          code: projectCode,
          name: fullProject.name || '',
          vertical: fullProject.vertical || 'SUPPORT',
          category: fullProject.category || 'NPC',
          tbc: fullProject.tbc || 'Yes',
          status: fullProject.status || 'Active',
          buDomain: fullProject.buDomain || 'NA',
          businessUnit: fullProject.businessUnit || 'NA',
          projectType: fullProject.projectType || 'NA',
          productFamily: fullProject.productFamily || 'SUPPORT',
          pace: fullProject.pace || '-',
          segment: fullProject.segment || 'NA',
          timelineOffset: 0,
          igGates: [],
          rows: {},
          pmoRows: {},
          actuals: {},
          forecast: {},
          budgetFYs: [],
          actualsFYs: [],
          forecastFYs: [],
          [fyTagKey]: fyStrings.includes('All FY') ? ['FY 25-26'] : fyStrings
        };
        updated.push(p);
        pIdx = updated.length - 1;
      }

      // Update employeeInfo
      const newEmployeeInfo = { ...(p.employeeInfo || {}) };
      newEmployeeInfo[email] = {
        ...newEmployeeInfo[email],
        name: empInfo.name,
        email: email,
        skill: empInfo.skill || skill,
        category: empInfo.category || 'Direct Employee'
      };

      const empSkillsKey = mode === 'Actuals' ? 'actualsEmployeeSkills' : (mode === 'Forecast' ? 'forecastEmployeeSkills' : 'pmoEmployeeSkills');
      const skillsKey = mode === 'Actuals' ? 'actualsSkills' : (mode === 'Forecast' ? 'forecastSkills' : 'pmoSkills');

      // Update employeeSkills
      const existingEmpSkills = (p as any)[empSkillsKey] || {};
      const newEmployeeSkills = JSON.parse(JSON.stringify(existingEmpSkills || {}));
      if (!newEmployeeSkills[skill]) newEmployeeSkills[skill] = {};
      
      // Check if this is a "clear" operation (all zeros)
      const hasAnyAlloc = monthlyAllocs.some(v => v > 0);
      if (!hasAnyAlloc) {
        delete newEmployeeSkills[skill][email];
        // If skill group is empty, clean it up
        if (Object.keys(newEmployeeSkills[skill]).length === 0) {
          delete newEmployeeSkills[skill];
        }
      } else {
        newEmployeeSkills[skill][email] = monthlyAllocs;
      }

      // Re-calculate aggregate skills[skill] for the current project view
      const newSkills = { ...((p as any)[skillsKey] || {}) };
      const skillAllocations = new Array(MAX_MONTHS).fill(0);
      if (newEmployeeSkills[skill]) {
        Object.values(newEmployeeSkills[skill] as any).forEach(empAlloc => {
          const allocs = Array.isArray(empAlloc) ? empAlloc : [];
          allocs.forEach((v, i) => {
            if (i < MAX_MONTHS) skillAllocations[i] += (Number(v) || 0);
          });
        });
        newSkills[skill] = skillAllocations;
      } else {
        newSkills[skill] = skillAllocations;
      }

      // Sync with budget/forecast/actuals view if needed
      const targetKey = mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows');
      const newTargetData = { ...(p[targetKey] || {}) };
      newTargetData[skill] = newSkills[skill];

      updated[pIdx] = {
        ...p,
        employeeInfo: newEmployeeInfo,
        [empSkillsKey]: newEmployeeSkills,
        [skillsKey]: newSkills,
        [targetKey]: newTargetData
      };

      return updated;
    });
    triggerLocalUpdate();
  };

  const handleUpdateIgGate = (projectCode: string, monthIndex: number, value: string) => {
    setProjects(prev => {
      const targetCode = (projectCode || '').trim().toUpperCase();
      const existingIdx = prev.findIndex(p => (p.code || '').trim().toUpperCase() === targetCode);
      let updated = [...prev];
      let pIdx = existingIdx;
      
      let p: ProjectData;
      if (existingIdx !== -1) {
        p = updated[existingIdx];
      } else {
        const fullProject = masterProjects.find(mp => (mp.code || '').trim().toUpperCase() === targetCode);
        if (!fullProject) return prev;
        const fyTagKey = mode === 'Actuals' ? 'actualsFYs' : (mode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
        const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
        p = {
          id: projectCode,
          code: projectCode,
          name: fullProject.name || '',
          vertical: fullProject.vertical || 'SUPPORT',
          category: fullProject.category || 'NPC',
          tbc: fullProject.tbc || 'Yes',
          status: fullProject.status || 'Active',
          buDomain: fullProject.buDomain || 'NA',
          businessUnit: fullProject.businessUnit || 'NA',
          projectType: fullProject.projectType || 'NA',
          productFamily: fullProject.productFamily || 'SUPPORT',
          pace: fullProject.pace || '-',
          segment: fullProject.segment || 'NA',
          timelineOffset: 0,
          igGates: [],
          rows: {},
          pmoRows: {},
          actuals: {},
          forecast: {},
          budgetFYs: [],
          actualsFYs: [],
          forecastFYs: [],
          [fyTagKey]: fyStrings.includes('All FY') ? [DEFAULT_FY] : fyStrings
        };
        updated.push(p);
        pIdx = updated.length - 1;
      }
      
      const newIgGates = ensureArray(p.igGates || new Array(MAX_MONTHS).fill(''), MAX_MONTHS);
      const globalIdx = monthIndices[monthIndex];
      newIgGates[globalIdx] = value;
      updated[pIdx] = { ...p, igGates: newIgGates };
      return updated;
    });
    triggerLocalUpdate();
  };


  const verticalDistributionData = useMemo(() => {
    const dist: Record<string, number> = {};
    (processedProjects.results || []).forEach(p => {
      dist[p.vertical] = (dist[p.vertical] || 0) + (p.actualSpentCr || 0);
    });
    return Object.entries(dist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [processedProjects]);

  const categoryMixData = useMemo(() => {
    const dist: Record<string, number> = {};
    (processedProjects.results || []).forEach(p => {
      dist[p.category] = (dist[p.category] || 0) + (p.actualSpentCr || 0);
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [processedProjects]);

  const InfoField = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col space-y-1">
      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
      <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase flex items-center text-slate-700">
        {value || '-'}
      </div>
    </div>
  );

  const mergeData = (existingData: any, importedData: any, forceGlobal = false) => {
    const result = { ...(existingData || {}) };
    if (!importedData) return result;
    
    const startIdx = (selectedFY === 'All FY' || forceGlobal) ? 0 : yearOffset;
    const endIdx = (selectedFY === 'All FY' || forceGlobal) ? MAX_MONTHS : yearOffset + 12;

    Object.entries(importedData).forEach(([cat, importedValues]: [string, any]) => {
      const existingArray = ensureArray(result[cat], MAX_MONTHS);
      
      if (Array.isArray(importedValues)) {
        if (importedValues.length === MAX_MONTHS) {
          for (let i = 0; i < MAX_MONTHS; i++) {
              // Bypassing range check if forceGlobal is true to allow full 36-month merge
              if (forceGlobal || (i >= startIdx && i < endIdx)) {
                  existingArray[i] = (importedValues[i] || 0);
              }
          }
        } else {
          importedValues.forEach((v: number, i: number) => {
            const finalIdx = startIdx + i;
            if (finalIdx >= 0 && finalIdx < MAX_MONTHS) {
                if (forceGlobal || (finalIdx >= startIdx && finalIdx < endIdx)) {
                    existingArray[finalIdx] = (v || 0);
                }
            }
          });
        }
      } else if (importedValues && typeof importedValues === 'object') {
        Object.entries(importedValues as Record<string, number>).forEach(([idxStr, v]) => {
          const idx = parseInt(idxStr);
          if (!isNaN(idx)) {
            const finalIdx = (idx < 12 && !forceGlobal && selectedFY !== 'All FY') ? startIdx + idx : idx;
            if (finalIdx >= 0 && finalIdx < MAX_MONTHS) {
                if (forceGlobal || (finalIdx >= startIdx && finalIdx < endIdx)) {
                    existingArray[finalIdx] = (v || 0);
                }
            }
          }
        });
      }
      result[cat] = existingArray;
    });
    return result;
  };

  const mergeAllocationArray = (existing: number[] | undefined, imported: number[], forceGlobal = false) => {
    const result = ensureArray(existing, MAX_MONTHS);
    const startIdx = (selectedFY === 'All FY' || forceGlobal) ? 0 : yearOffset;
    const endIdx = (selectedFY === 'All FY' || forceGlobal) ? MAX_MONTHS : yearOffset + 12;
    
    imported.forEach((v, i) => {
      // If imported has absolute indexing
      if (imported.length === MAX_MONTHS) {
        if (forceGlobal || (i >= startIdx && i < endIdx)) {
          if (i >= 0 && i < MAX_MONTHS) result[i] = (v || 0);
        }
      } else {
        // If imported has local indexing (length 12)
        const finalIdx = startIdx + i;
        if (finalIdx >= 0 && finalIdx < MAX_MONTHS) {
            if (forceGlobal || (finalIdx >= startIdx && finalIdx < endIdx)) {
                result[finalIdx] = (v || 0);
            }
        }
      }
    });
    return result;
  };

  const finalizeImport = () => {
    if (!pendingImportData) return;
    
    setProjects(prev => {
      const newProjects = [...prev];
      pendingImportData.projects.forEach((p: any) => {
        if (p.status === 'error') return;
        const { status, errors, hasEstimationData, rows, pmoRows, igGates, remarks, actuals, forecast, employeeSkills, actualsEmployeeSkills, forecastEmployeeSkills, employeeInfo, ...projectPayload } = p;
        const idx = newProjects.findIndex(np => np.id === p.id);
        
        if (idx !== -1) {
          const existing = newProjects[idx];
          const updated = { ...existing, ...projectPayload };
          
          // Merge employeeSkills based on mode
          const mergeSkills = (sourceObj: any, targetKey: 'employeeSkills' | 'pmoEmployeeSkills' | 'actualsEmployeeSkills' | 'forecastEmployeeSkills') => {
            if (sourceObj && Object.keys(sourceObj).length > 0) {
              if (!updated[targetKey]) updated[targetKey] = {};
              Object.entries(sourceObj as Record<string, Record<string, number[]>>).forEach(([skill, emps]) => {
                if (!updated[targetKey]![skill]) updated[targetKey]![skill] = {};
                Object.entries(emps).forEach(([email, allocs]) => {
                  updated[targetKey]![skill][email] = mergeAllocationArray(updated[targetKey]![skill][email], allocs, true);
                });
              });
            }
          };

          if (mode === 'Actuals') {
            mergeSkills(actualsEmployeeSkills, 'actualsEmployeeSkills');
          } else if (mode === 'Forecast') {
            mergeSkills(forecastEmployeeSkills, 'forecastEmployeeSkills');
          } else {
            mergeSkills(employeeSkills, 'pmoEmployeeSkills');
          }

          if (employeeInfo) updated.employeeInfo = { ...(updated.employeeInfo || {}), ...employeeInfo };

          if (hasEstimationData) {
            if (mode === 'Budget') {
              updated.pmoRows = mergeData(existing.pmoRows, pmoRows, true);
              updated.budgetFYs = Array.from(new Set([...(existing.budgetFYs || []), ...ALL_FISCAL_YEARS.filter(y => y !== 'All FY')].filter(Boolean)));
              if (igGates) updated.igGates = { ...(existing.igGates || {}), ...igGates };
              if (remarks) updated.remarks = { ...(existing.remarks || {}), ...remarks };
            } else if (mode === 'Actuals') {
              updated.actuals = mergeData(existing.actuals, actuals, true);
              updated.actualsFYs = Array.from(new Set([...(existing.actualsFYs || []), ...ALL_FISCAL_YEARS.filter(y => y !== 'All FY')].filter(Boolean)));
            } else if (mode === 'Forecast') {
              updated.forecast = mergeData(existing.forecast, forecast, true);
              updated.forecastFYs = Array.from(new Set([...(existing.forecastFYs || []), ...ALL_FISCAL_YEARS.filter(y => y !== 'All FY')].filter(Boolean)));
            }
          }
          newProjects[idx] = updated;
        } else {
          const newProject = {
            ...projectPayload,
            rows: {},
            pmoRows: pmoRows || {},
            actuals: actuals || {},
            forecast: forecast || {},
            budgetFYs: mode === 'Budget' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
            actualsFYs: mode === 'Actuals' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
            forecastFYs: mode === 'Forecast' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
            igGates: igGates || {},
            remarks: remarks || {},
            pmoEmployeeSkills: mode === 'Budget' ? (employeeSkills || {}) : {},
            employeeSkills: {},
            actualsEmployeeSkills: mode === 'Actuals' ? (actualsEmployeeSkills || {}) : {},
            forecastEmployeeSkills: mode === 'Forecast' ? (forecastEmployeeSkills || {}) : {},
            employeeInfo: employeeInfo || {},
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          newProjects.push(newProject);
        }
      });
      return newProjects;
    });
    triggerLocalUpdate();
    // Force a re-render or state update to ensure the UI reflects the new data
    forceUpdate();
    setProcessedImportData(pendingImportData);
    setRawData([]); // Clear raw data if processed is used
    setIsImportInspectionOpen(false);
    setPendingImportData(null);
    const committedCount = pendingImportData.summary ? (pendingImportData.summary.valid + pendingImportData.summary.updates) : pendingImportData.projects.length;
    setStatusMessage({ type: 'success', text: `Successfully committed ${committedCount} projects.` });
  };

  const handleConfirmImport = () => {
    if (tempRawData) {
      // Use 'All FY' to capture all data from the file during import, 
      // regardless of what's currently selected in the UI.
      const { results: rawProjects } = processRawData(tempRawData, 'All FY', masterConfig, mode, existingProjects, masterEmployees);
      
      setProjects(prev => {
        const newProjectsList = [...prev];
        rawProjects.forEach((p: any) => {
          const idx = newProjectsList.findIndex(np => np.code === p.code);
          const targetKey = mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows');
          const fyTagKey = mode === 'Actuals' ? 'actualsFYs' : (mode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');

          if (idx !== -1) {
            const existing = newProjectsList[idx];
            const updated = { ...existing };
            
            // Merge the new data into the correct property based on mode
            const mergeRawSkills = (sourceObj: any, targetKey: 'employeeSkills' | 'pmoEmployeeSkills' | 'actualsEmployeeSkills' | 'forecastEmployeeSkills') => {
              if (sourceObj && Object.keys(sourceObj).length > 0) {
                if (!updated[targetKey]) updated[targetKey] = {};
                Object.entries(sourceObj as Record<string, Record<string, number[]>>).forEach(([skill, emps]) => {
                if (!updated[targetKey]![skill]) updated[targetKey]![skill] = {};
                Object.entries(emps).forEach(([email, allocs]) => {
                  updated[targetKey]![skill][email] = mergeAllocationArray(updated[targetKey]![skill][email], allocs, true);
                });
                });
              }
            };

            if (mode === 'Actuals') {
              mergeRawSkills(p.actualsEmployeeSkills, 'actualsEmployeeSkills');
            } else if (mode === 'Forecast') {
              mergeRawSkills(p.forecastEmployeeSkills, 'forecastEmployeeSkills');
            } else {
              mergeRawSkills(p.employeeSkills, 'pmoEmployeeSkills');
            }

            if (p.employeeInfo && Object.keys(p.employeeInfo).length > 0) {
              updated.employeeInfo = { ...(updated.employeeInfo || {}), ...p.employeeInfo };
            }

            if (mode === 'Budget') {
              updated.pmoRows = p.pmoRows;
            } else if (mode === 'Actuals') {
              updated.actuals = p.actuals;
            } else if (mode === 'Forecast') {
              updated.forecast = p.forecast;
            }

            // Update FY tags
            const updatedAny = updated as any;
            updatedAny[fyTagKey] = Array.from(new Set([...((existing[fyTagKey as keyof ProjectData] as string[]) || []), ...ALL_FISCAL_YEARS.filter(y => y !== 'All FY')].filter(Boolean)));
            
            newProjectsList[idx] = updated;
          } else {
            // New project
            const newProject: any = {
              ...p,
              id: p.code,
              pmoRows: mode === 'Budget' ? p.pmoRows : {},
              actuals: mode === 'Actuals' ? p.actuals : {},
              forecast: mode === 'Forecast' ? p.forecast : {},
              budgetFYs: mode === 'Budget' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
              actualsFYs: mode === 'Actuals' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
              forecastFYs: mode === 'Forecast' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [],
              pmoEmployeeSkills: mode === 'Budget' ? (p.employeeSkills || {}) : {},
              employeeSkills: {},
              actualsEmployeeSkills: mode === 'Actuals' ? (p.actualsEmployeeSkills || {}) : {},
              forecastEmployeeSkills: p.forecastEmployeeSkills || {},
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            
            newProjectsList.push(newProject);
          }
        });
        return newProjectsList;
      });
      
      setRawData([]);
      setProcessedImportData(null);
      setStatusMessage({ type: 'success', text: `Successfully loaded ${rawProjects.length} projects.` });
      setTempRawData(null);
      setIsConfirmModalOpen(false);
      triggerLocalUpdate();
      forceUpdate();
    }
  };

  return (
    <div key={renderKey} className="pt-0 px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3 lg:pb-4 max-w-full mx-auto animate-fadeIn bg-[#f8fafc] min-h-screen space-y-4">
      <PortfolioIntelligenceBar stats={stats} label="PMO HUB" />
      <ImportInspectionModal 
        isOpen={isImportInspectionOpen} 
        data={pendingImportData} 
        onClose={() => { setIsImportInspectionOpen(false); setPendingImportData(null); }} 
        onConfirm={finalizeImport} 
        fiscalMode={mode}
      />

      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="bg-indigo-600 p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Confirm Raw Import</h3>
              <p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">Reviewing Data Payload Impact</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">New Projects</span>
                  <span className="text-2xl font-black text-emerald-600">{importStats.newProjects}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Updates</span>
                  <span className="text-2xl font-black text-blue-600">{importStats.updateProjects}</span>
                </div>
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-900 uppercase">Total Data Rows</span>
                  <span className="text-sm font-black text-indigo-700">{importStats.totalRows.toLocaleString()}</span>
                </div>
              </div>
              
              <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                You are about to import <span className="font-black text-slate-900">{importStats.totalRows.toLocaleString()}</span> rows of data. 
                This will affect <span className="font-black text-slate-900">{importStats.newProjects + importStats.updateProjects}</span> unique project codes.
              </p>
            </div>
            
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => { setIsConfirmModalOpen(false); setTempRawData(null); setStatusMessage(null); }}
                className="flex-1 px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmImport}
                className="flex-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Proceed with Import
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      <FilterBar 
        filters={filters} 
        setFilters={setFilters} 
        dynamicOptions={dynamicOptions} 
        authorizedVerticals={['All', ...masterConfig.verticals]} 
        actionButtons={
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl h-10 px-2 shadow-sm mr-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[10px] font-black text-slate-700 uppercase focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="default">Default</option>
                <option value="manpower">Manpower (MM)</option>
                <option value="expense">Expense</option>
                <option value="total">Total</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
                title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
              >
                <svg className={`w-3.5 h-3.5 transform transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* 'New' button removed as projects are managed via Master Project List */}

            {mode === 'Actuals' && (
              <button 
                onClick={() => { setImportType('raw'); fileInputRef.current?.click(); }}
                className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || isLocked}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 16V4m-4 4l4-4 4 4" strokeWidth="3"/></svg>
                <span>Import</span>
              </button>
            )}

            {isAdmin && (mode === 'Budget' || mode === 'Forecast') && (
              <button 
                onClick={() => { setImportType('raw'); fileInputRef.current?.click(); }}
                className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || isLocked || (() => {
                  const fyStrings = Array.isArray(selectedFYs) ? (selectedFYs as string[]) : [String(selectedFYs)];
                  const yearsToCheck = fyStrings.includes('All FY') ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : fyStrings;
                  return masterConfig.isFiscalLocked || yearsToCheck.some(fy => !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Budget`] || !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_master`]);
                })()}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 16V4m-4 4l4-4 4 4" strokeWidth="3"/></svg>
                <span>Import</span>
              </button>
            )}
            
            {/* 'Import Processed' button removed as requested */}
            {isAdmin && mode === 'Actuals' && (processedProjects.results || []).length > 0 && (
              <button 
                onClick={onDeleteAll}
                disabled={isProcessing || isLocked}
                className="h-10 px-4 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-500 uppercase hover:bg-rose-50 transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Delete All</span>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".xlsx, .xls, .csv"
            />
            <button 
              onClick={handleExport}
              disabled={isProcessing}
              className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m-4-4l4 4 4-4" strokeWidth="3"/></svg>
              <span>Export</span>
            </button>
          </div>
        }
      />

      {isProcessing && processingProgress > 0 && (
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200 mb-4">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${processingProgress}%` }}
            className="h-full bg-indigo-600"
          />
        </div>
      )}

      {statusMessage && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
          statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' && <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
            {statusMessage.type === 'error' && <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            {statusMessage.type === 'info' && <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-current opacity-50 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      )}

      {(processedProjects.results || []).length === 0 && rawData.length > 0 && !isProcessing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-6 rounded-xl text-sm font-medium text-center space-y-3">
          <p>No projects found for the selected Fiscal Year ({selectedFY}) or matching the current filters.</p>
          {rawData.length > 0 && (
            <div className="flex flex-col items-center space-y-2">
              <div className="flex flex-wrap justify-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-80">
                <div className="bg-white px-3 py-1 rounded-full border border-amber-200">Total Rows: {processedProjects.metadata?.totalRows || 0}</div>
                <div className="bg-white px-3 py-1 rounded-full border border-amber-200 text-emerald-600">Valid Rows: {processedProjects.metadata?.processedCount || 0}</div>
                <div className="bg-white px-3 py-1 rounded-full border border-amber-200 text-rose-600">Date Errors: {processedProjects.metadata?.dateErrorCount || 0}</div>
                <div className="bg-white px-3 py-1 rounded-full border border-amber-200 text-blue-600">FY Mismatch: {processedProjects.metadata?.fyMismatchCount || 0}</div>
              </div>
              {processedProjects.metadata?.fyMismatchCount > 0 && (
                <p className="text-[10px] text-blue-600 font-black uppercase animate-pulse">
                  Tip: {processedProjects.metadata?.fyMismatchCount || 0} rows belong to other Fiscal Years. Try changing the FY dropdown above.
                </p>
              )}
            </div>
          )}
          <p className="text-xs opacity-80">Make sure the dates in your Excel file fall within {selectedFY} (April to March).</p>
        </div>
      )}

      {processedProjects.unfiltered.length === 0 && rawData.length === 0 && !isProcessing && (
        <div className="bg-white border border-slate-200 text-slate-500 px-4 py-12 rounded-xl text-sm font-medium text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No Data Loaded</h3>
            <p className="mt-1 text-slate-500">Please import an Excel file to view project data.</p>
          </div>
        </div>
      )}

      {activeTab === 'analytics' ? (
        <PMOAnalyticsView 
          projects={processedProjects.results || []} 
          months={months} 
          employees={pmoEmployees} 
          selectedFY={selectedFY} 
          selectedFYs={Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs]}
          config={masterConfig} 
          mode={mode}
          setMode={setMode}
          filters={filters}
        />
      ) : (
        <div className="space-y-2">
          {processedProjects.results.length > 0 ? (
            processedProjects.results.slice().sort((a, b) => {
              if (sortBy === 'default') return 0;
              let valA = 0, valB = 0;
              if (sortBy === 'manpower') { valA = a.manpowerSpentCr; valB = b.manpowerSpentCr; }
              else if (sortBy === 'expense') { valA = a.expenseSpentCr; valB = b.expenseSpentCr; }
              else if (sortBy === 'total') { valA = a.actualSpentCr; valB = b.actualSpentCr; }
              return sortOrder === 'desc' ? valB - valA : valA - valB;
            }).map((p, i) => {
            const InfoField = ({ label, value, field, type = 'text', options }: { label: string, value: any, field?: string, type?: string, options?: string[] }) => {
              const currentPart = mode === 'Budget' ? 'Budget' : (mode === 'Forecast' ? 'Forecast' : 'Actuals');
              const isPartLocked = isProjectPartLocked(p, currentPart);
              return (
                <div className="flex flex-col space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
                  {field && !isPartLocked ? (
                    options ? (
                      <select
                        value={(value !== undefined && value !== null ? String(value) : '').toLowerCase()}
                        onChange={(e) => handleUpdateProject(p.code, field, e.target.value, p)}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        {options.map(opt => <option key={opt.toLowerCase()} value={opt.toLowerCase()}>{opt.toUpperCase()}</option>)}
                      </select>
                    ) : (
                      <input
                        type={type}
                        step="0.01"
                        value={value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateProject(p.code, field, type === 'number' ? (val === '' ? 0 : parseFloat(val)) : val, p);
                        }}
                        className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder={`Enter ${label}`}
                      />
                    )
                  ) : (
                    <div className="h-9 px-3 border rounded-lg text-[10px] font-black uppercase flex items-center text-slate-700 overflow-hidden truncate bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed">
                      {value === undefined || value === null ? '' : (type === 'number' && typeof value === 'number' ? formatCr(value) : String(value))}
                    </div>
                  )}
                </div>
              );
            };

            const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
            const fy = p.fiscalYear || selectedFY;
            const fyConfig = masterConfig.fyFinancials?.[fy];
            const hourlyRate = (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : RATE_PER_HOUR;
            const contractedRate = (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : CONTRACTED_EMPLOYEE_RATE;
            const hpm = 180;

            // Pre-calculate rates for the range to avoid repeated lookups
            const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
            for (let i = 0; i < months.length; i++) {
              const monthIdx = i + yearOffset;
              const startYear = 19 + Math.floor(monthIdx / 12);
              const fyStr = `FY ${startYear}-${startYear + 1}`;
              const fyConfig = masterConfig.fyFinancials?.[fyStr];
              ratesCache[i] = {
                hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
                cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
              };
            }

            // Use the correct data source based on mode
            const dataKey = mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows');

            const directMM = months.map((_, i) => {
              const globalIdx = monthIndices[i];
              return MANPOWER_CATEGORIES.filter(cat => cat !== 'Consultant').reduce((acc, cat) => {
                const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
                return acc + (arr[globalIdx] || 0);
              }, 0);
            });
            const contractedMM = months.map((_, i) => {
              const globalIdx = monthIndices[i];
              const arr = getAuthoritativeRowUI(p as any, 'Contracted Employee', dataKey);
              return (arr[globalIdx] || 0);
            });
            const totalMM = directMM.map((v, i) => Math.round((v + contractedMM[i]) * 100) / 100);
            
            const directCr = isHolidayLeave ? new Array(months.length).fill(0) : directMM.map((v, i) => Math.round(((v * ratesCache[i].hRate * hpm) / 10000000) * 100) / 100);
            const contractedCr = isHolidayLeave ? new Array(months.length).fill(0) : contractedMM.map((v, i) => Math.round(((v * ratesCache[i].cRate * hpm) / 10000000) * 100) / 100);
            const totalManpowerCr = directCr.map((v, i) => Math.round((v + contractedCr[i]) * 100) / 100);

            const monthlyExpCr = isHolidayLeave ? new Array(months.length).fill(0) : months.map((_, i) => {
              const globalIdx = monthIndices[i];
              // Gather all unique keys across all possible sources to calculate any other expenses
              const expKeys = new Set<string>([
                ...EXPENSE_CATEGORIES,
                ...Object.keys(p.pmoRows || {}),
                ...Object.keys(p.rows || {}),
                ...Object.keys(p.actuals || {}),
                ...Object.keys(p.forecast || {}),
                ...Object.keys(p.skills || {}),
                ...Object.keys(p.expenses || {}),
                ...Object.keys(p.employeeSkills || {}),
                ...Object.keys(p.actualsEmployeeSkills || {}),
                ...Object.keys(p.forecastEmployeeSkills || {})
              ]);
              return Array.from(expKeys).reduce((acc, cat) => {
                const mappedCat = SKILL_MAPPING[cat] || cat;
                if (mappedCat === 'Contracted Employee' || MANPOWER_CATEGORIES.includes(mappedCat as any)) {
                  return acc; // Skip manpower
                }
                const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
                const val = arr[globalIdx] || 0;
                return acc + val;
              }, 0);
            }).map(v => Math.round(v * 100) / 100);
            
            const grandTotal = totalManpowerCr.map((v, i) => Math.round((v + monthlyExpCr[i]) * 100) / 100);
            
            const aggMM = totalMM.reduce((a, b) => a + b, 0);
            const aggManpowerCr = totalManpowerCr.reduce((a, b) => a + b, 0);
            const aggExpCr = monthlyExpCr.reduce((a, b) => a + b, 0);
            const aggTotalCr = grandTotal.reduce((a, b) => a + b, 0);

            const analysisData = months.map((m, i) => ({
              name: m,
              manpower: totalManpowerCr[i],
              expense: monthlyExpCr[i],
              total: grandTotal[i],
              mm: totalMM[i]
            }));

            const pieData = [
              { name: 'Manpower', value: aggManpowerCr, color: '#4f46e5' },
              { name: 'Expense', value: aggExpCr, color: '#10b981' }
            ];

            const fyIgGates = monthIndices.map(idx => ensureArray(p.igGates, MAX_MONTHS)[idx] || '');

            const manpowerRowsData = Object.fromEntries([...MANPOWER_CATEGORIES.filter(cat => cat !== 'Consultant'), 'Contracted Employee'].map(cat => {
              const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
              const sliced = months.map((_, i) => arr[monthIndices[i]] || 0);
              return [cat, sliced.map(v => Math.round(v * 100) / 100)];
            }));
            console.log('manpowerRowsData for project', p.code, manpowerRowsData);

            const expenseRowsData = Object.fromEntries(EXPENSE_CATEGORIES.filter(cat => cat !== 'Contracted Employee').map(cat => {
              const isContractedExp = cat === 'Contracted Employee Expense';
              
              let row: number[];
              if (isContractedExp) {
                const rawRow = (p[dataKey] as any)?.['Contracted Employee Expense'];
                
                if (rawRow && Array.isArray(rawRow) && rawRow.some((v) => v !== 0)) {
                  row = ensureArray(rawRow, MAX_MONTHS).map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
                } else {
                  // Fallback: Check if Contracted Employee has MM, then calculate expense
                  const mmRow = getAuthoritativeRowUI(p as any, 'Contracted Employee', dataKey);
                  row = mmRow.map(mm => {
                    return isHolidayLeave ? 0 : Math.round(((mm * contractedRate * hpm) / 10000000) * 100) / 100;
                  });
                }
              } else {
                const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
                row = arr.map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
              }
              const sliced = months.map((_, i) => row[monthIndices[i]] || 0);
              return [cat, sliced];
            }));

            const otherManpowerRowsData = Object.fromEntries(Object.keys(p.skills || {}).filter(cat => !(MANPOWER_CATEGORIES as readonly string[]).includes(cat) && cat !== 'Contracted Employee' && !isSummaryOrCalculatedLabel(cat)).map(cat => {
              const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
              const sliced = months.map((_, i) => arr[monthIndices[i]] || 0);
              return [cat, sliced.map(v => Math.round(v * 100) / 100)];
            }));

            const otherExpenseRowsData = Object.fromEntries(Object.keys(p.expenses || {}).filter(cat => !(EXPENSE_CATEGORIES as readonly string[]).includes(cat) && !(MANPOWER_CATEGORIES as readonly string[]).includes(cat) && !isSummaryOrCalculatedLabel(cat)).map(cat => {
              const arr = getAuthoritativeRowUI(p as any, cat, dataKey);
              const sliced = months.map((_, i) => arr[monthIndices[i]] || 0);
              const slicedCost = sliced.map(v => isHolidayLeave ? 0 : Math.round(v * 100) / 100);
              return [cat, slicedCost];
            }));

            const displayManpowerCr = isHolidayLeave ? 0 : p.manpowerSpentCr;
            const displayExpenseCr = isHolidayLeave ? 0 : p.expenseSpentCr;
            const displayTotalCr = isHolidayLeave ? 0 : p.actualSpentCr;

            const targetFY = (p.fiscalYear && p.fiscalYear !== 'All FY') ? p.fiscalYear : (Array.isArray(selectedFYs) ? selectedFYs[0] : String(selectedFYs));
            const isPMOForecastGloballyLocked = isProjectPartLocked(p, 'Forecast');
            
            const fyStrings = Array.isArray(selectedFYs) ? (selectedFYs as string[]) : [String(selectedFYs)];
            const yearsToCheck = fyStrings.includes('All FY') ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : fyStrings;
            
            return (
              <div key={i} className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden w-full relative transition-all hover:border-indigo-200">
            <div 
              className="flex flex-col lg:flex-row lg:items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-50/30 transition-all select-none gap-2"
              onClick={() => setExpandedProject(expandedProject === p.code ? null : p.code)}
            >
              <div className="flex items-center space-x-3 min-w-0 flex-grow">
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 shrink-0 ${expandedProject === p.code ? 'rotate-90 text-indigo-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M9 5l7 7-7 7" />
                </svg>
                <span className="bg-[#001e3c] text-white px-2 py-1 rounded-full text-[8px] font-black uppercase shrink-0 shadow-xs leading-none border border-white/10" title="Project Code">{p.code}</span>
                {!p.isMaster && p.status && (p.status === 'valid' || p.status === 'update') && (
                  <span className={`px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-tighter shadow-xs border ${
                    p.status === 'valid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {p.status === 'valid' ? 'New Project' : 'Update Existing'}
                  </span>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                  <h3 className="font-black text-[11px] truncate leading-none uppercase tracking-tight text-slate-900">{p.name}</h3>
                  <div className="hidden sm:flex items-center space-x-3 shrink-0 border-l border-slate-100 pl-3">
                    <MetaItem label="DOM" value={p.buDomain} maxW="max-w-[40px]" />
                    <MetaItem label="BU" value={p.businessUnit} maxW="max-w-[50px]" />
                  </div>

                </div>
              </div>

              <div className="flex items-center justify-end gap-3 sm:gap-5 shrink-0">
                <div className="flex items-center divide-x divide-slate-100 gap-0">
                  <div className="flex flex-col px-3 text-center">
                    <span className="text-[6px] text-slate-400 uppercase font-black tracking-tighter leading-none mb-0.5">MM</span>
                    <span className="text-[11px] font-black text-slate-900 leading-none">{formatCr(aggMM)}</span>
                  </div>
                  <div className="flex flex-col px-3 text-center">
                    <span className="text-[6px] text-blue-500 uppercase font-black tracking-tighter leading-none mb-0.5">MANPOWER</span>
                    <span className="text-[11px] font-black text-blue-600 leading-none">{formatCr(aggManpowerCr)}</span>
                  </div>
                  <div className="flex flex-col px-3 text-center">
                    <span className="text-[6px] text-emerald-500 uppercase font-black tracking-tighter leading-none mb-0.5">EXPENSE</span>
                    <span className="text-[11px] font-black text-emerald-600 leading-none">{formatCr(aggExpCr)}</span>
                  </div>
                  <div className="flex flex-col px-3 text-right">
                    <span className="text-[6px] text-indigo-500 uppercase font-black tracking-tighter mb-0.5">TOTAL</span>
                    <span className="text-[12px] font-black text-indigo-700 leading-none">{formatCr(aggTotalCr)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectExport(p as any);
                    }}
                    disabled={isProcessing}
                    className={`p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-100/50 hover:border-indigo-600 shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                      isProcessing ? 'opacity-55 cursor-not-allowed' : ''
                    }`}
                    title={`Export specific Excel data for project ${p.code}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={p.isMaster}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!p.isMaster) {
                        handleUpdateProject(p.code, 'isLocked', !p.isLocked, p);
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      p.isMaster ? 'opacity-20 cursor-not-allowed text-slate-300' :
                      p.isLocked 
                        ? 'text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100' 
                        : 'text-slate-300 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                    }`}
                    title={p.isMaster ? "Master Project - Read Only" : (p.isLocked ? "Unlock Project" : "Lock Project")}
                  >
                    {p.isLocked ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {expandedProject === p.code && (
              <div className="border-t border-slate-100 p-0 animate-fadeIn relative flex flex-col bg-slate-50/30">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-1.5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center bg-white p-1 rounded-xl shadow-xs border border-slate-200 overflow-x-auto no-scrollbar">
                    {(['info', 'estimation', 'forecast', 'allocation', 'team', 'roster', 'employeeAnalysis', 'expenseList'] as const)
                      .filter(tab => !(mode === 'Actuals' && tab === 'forecast'))
                      .map(tab => {
                        const isPMOBudgetLocked = masterConfig.isFiscalLocked || yearsToCheck.some(fy => !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Budget`] || !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_master`]);
                        const isPMOActualsLocked = masterConfig.isFiscalLocked || yearsToCheck.some(fy => !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_Actuals`] || !!masterConfig.fiscalLocks?.[`pmo_page_${fy}_master`]);
                        const isTabSpecificLocked = (tab === 'estimation' || tab === 'allocation') && (isPMOBudgetLocked || isPMOActualsLocked);
                        
                        const isDisabled = ((tab === 'estimation' || tab === 'forecast' || tab === 'allocation' || tab === 'team') && (p.budgetMode || 'detailed') === 'fixed') || isTabSpecificLocked;
                        return (
                          <button 
                            key={tab}
                            disabled={isDisabled}
                            onClick={() => setActiveInnerTab(prev => ({ ...prev, [p.code]: tab }))}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                              (activeInnerTab[p.code] || 'info') === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                            } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            {tab === 'info' ? 'Project Info' : 
                             tab === 'estimation' ? 'Budget' : 
                             tab === 'forecast' ? 'Forecast' : 
                             tab === 'team' ? 'Team View' : 
                             tab === 'allocation' ? 'Resource Allocation' :
                             tab === 'roster' ? 'Employee Roster' :
                             tab === 'employeeAnalysis' ? 'Employee Analysis' : 'Expense Split'}
                          </button>
                        );
                    })}
                  </div>
                </div>

                <div className="p-0">
                  {p.importErrors && p.importErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Critical Validation Errors</h4>
                      </div>
                      <ul className="space-y-1">
                        {p.importErrors.map((err, idx) => (
                          <li key={idx} className="text-[9px] font-bold text-rose-500 uppercase flex items-center space-x-2">
                            <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                            <span>{err}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'info' && (
                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
                      <div className="md:col-span-1 space-y-4">
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Core Identity</h4>
                            <div className="space-y-3">
                               <InfoField label="Project Code" value={p.code} />
                               <InfoField label="Project Name" value={p.name} field="name" />
                               <InfoField label="Vertical" value={p.vertical} field="vertical" options={masterConfig.verticals} />
                               <InfoField label="TBC Status" value={p.tbc} field="tbc" options={['Yes', 'No']} />
                            </div>
                         </div>
                         <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
                            <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Realization Metrics</h4>
                            <div className="grid grid-cols-2 gap-3">
                               <InfoField label="Budget Mode" value={p.budgetMode || 'detailed'} field="budgetMode" type="select" options={['fixed', 'detailed']} />
                               <InfoField label="FY BUDGET (Cr)" value={p.portfolioBudgetCr} field={(p.budgetMode || 'detailed') === 'fixed' ? "portfolioBudgetCr" : undefined} type="number" />
                               <div>
                                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">REMAINING</span>
                                  <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                                    ₹{formatCr(p.portfolioBudgetCr - p.actualSpentCr)}
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-2 gap-4">
                         <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 border-l-4 border-slate-200">Domain & Function</h4>
                           <InfoField label="Domain" value={p.buDomain} field="buDomain" options={masterConfig.buDomains} />
                           <InfoField label="Business Unit" value={p.businessUnit} field="businessUnit" options={masterConfig.businessUnits} />
                           <InfoField label="Product Family" value={p.productFamily} field="productFamily" options={masterConfig.productFamilies} />
                           <InfoField label="PDH / Manager" value={p.pdh} field="pdh" />
                         </div>
                         <div className="space-y-6">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 border-l-4 border-slate-200">Market Profile</h4>
                           <InfoField label="Project Type" value={p.projectType} field="projectType" options={masterConfig.projectTypes} />
                           <InfoField label="Customer" value={p.customer} field="customer" />
                           <InfoField label="Category" value={p.category} field="category" options={masterConfig.projectCategories} />
                           <InfoField label="Generation" value={p.generation} field="generation" options={['Current', 'Level Up + 1', 'Level Up + 2']} />
                           <div className="grid grid-cols-2 gap-3">
                              <InfoField label="PACE" value={p.pace} field="pace" options={masterConfig.paces} />
                              <InfoField label="Segment" value={p.segment} field="segment" options={masterConfig.segments} />
                           </div>
                         </div>
                      </div>

                      <div className="md:col-span-1 space-y-6">
                         <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Milestone Context</h4>
                            <div className="space-y-4">
                               <div className="grid grid-cols-2 gap-2">
                                  <InfoField label="SOP Month" value={p.sopMonth} field="sopMonth" />
                                  <InfoField label="SOP FY" value={p.sopFyYear} field="sopFyYear" />
                               </div>
                               <InfoField label="Current IG Gate" value={p.currentGate} field="currentGate" />
                               <InfoField label="Budget Horizon (Months)" value={p.forecastMonths} field="forecastMonths" type="number" />
                            </div>
                         </div>
                         <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Carry-over Financials</h4>
                            <div className="space-y-4">
                               <InfoField label="Prev. Budget" value={p.prevYearBudget} field="prevYearBudget" type="number" />
                               <InfoField label="Exp till Mar'26" value={p.expenseTillMar26} field="expenseTillMar26" type="number" />
                            </div>
                         </div>
                      </div>

                      <div className="md:col-span-4 mt-4">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Project Remarks History</label>
                         <div className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-700 uppercase">
                           {p.remarks?.[p.remarks.length - 1]?.text || 'NO REMARKS AVAILABLE'}
                         </div>
                      </div>
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'estimation' && (() => {
                    const ctx = getProjectRowsData(p, mode as FiscalMode);
                    return (
                      <div className="overflow-x-auto no-scrollbar animate-fadeIn">
                        <table className="w-full text-left border-separate border-spacing-0">
                          <EstimationHeader months={months} title={selectedFY} showRemarks={false} />
                          <EstimationTable
                            months={months}
                            igGates={monthIndices.map(idx => ensureArray(p.igGates, MAX_MONTHS)[idx] || '')}
                            manpowerRows={ctx.manpowerRows}
                            expenseRows={ctx.expenseRows}
                            otherManpowerRows={ctx.otherManpowerRows}
                            otherExpenseRows={ctx.otherExpenseRows}
                            monthlyMM={ctx.totalMM}
                            monthlyCr={ctx.totalManpowerCr}
                            directCr={ctx.directCr}
                            contractedCr={ctx.contractedCr}
                            monthlyExpCr={ctx.monthlyExpCr}
                            grandTotal={ctx.grandTotal}
                            totalMM={ctx.aggMM}
                            totalManpowerCr={ctx.aggManpowerCr}
                            totalExpenseCr={ctx.aggExpCr}
                            totalBudgetCr={ctx.aggTotalCr}
                            remarks={{}}
                            onUpdateIgGate={(idx, val) => {
                              handleUpdateIgGate(p.code, idx, val);
                            }}
                            onUpdateEstimation={(cat, idx, val, type) => {
                              if (type === 'manpower') {
                                handleUpdateEstimation(p.code, cat, idx, val, 'manpower', mode as FiscalMode);
                              } else {
                                const isContractedMM = cat === 'Contracted Employee';
                                if (isContractedMM) {
                                  handleUpdateEstimation(p.code, cat, idx, val, 'manpower', mode as FiscalMode);
                                } else {
                                  handleUpdateEstimation(p.code, cat, idx, val * 10000000, 'expense', mode as FiscalMode);
                                }
                              }
                            }}
                            onUpdateRemark={() => {}}
                            canEdit={!isProjectPartLocked(p, (mode === 'Variance' ? 'Budget' : mode) as any) && mode === 'Budget'}
                            isLocked={isProjectPartLocked(p, (mode === 'Variance' ? 'Budget' : mode) as any)}
                            mode={mode as FiscalMode}
                            showRemarks={false}
                            isAdmin={false}
                            currentMonthIndex={currentMonthIndex}
                          />
                        </table>
                      </div>
                    );
                  })()}

                  {(activeInnerTab[p.code] || 'info') === 'forecast' && mode !== 'Actuals' && (() => {
                    const ctx = getProjectRowsData(p, 'Forecast');
                    const hasForecastData = p.forecast && Object.keys(p.forecast).length > 0;
                    
                    return (
                      <div className="overflow-x-auto no-scrollbar animate-fadeIn p-4">
                        {!hasForecastData && (
                          <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-center justify-between mb-6 shadow-sm">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-amber-100 rounded-2xl shadow-sm">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-[12px] font-black text-amber-900 uppercase tracking-tight">Isolated Forecast Context</h4>
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest opacity-80">Sync disconnected. Baseline (Budget) data is available for cloning.</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const budgetData = p.pmoRows || {};
                                setProjects(prev => prev.map(proj => proj.code === p.code ? { ...proj, forecast: { ...budgetData }, forecastFYs: Array.from(new Set([...(proj.forecastFYs || []), ...(selectedFY === 'All FY' ? ALL_FISCAL_YEARS.filter(y => y !== 'All FY') : [selectedFY])])) } : proj));
                                triggerLocalUpdate();
                              }}
                              className="bg-amber-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-xl active:scale-[0.98] border-b-4 border-amber-800"
                            >
                              Clone From Budget
                            </button>
                          </div>
                        )}
                        <table className="w-full text-left border-separate border-spacing-0">
                          <EstimationHeader months={months} title={selectedFY} showRemarks={false} />
                          <EstimationTable
                            months={months}
                            igGates={monthIndices.map(idx => ensureArray(p.igGates, MAX_MONTHS)[idx] || '')}
                            manpowerRows={ctx.manpowerRows}
                            expenseRows={ctx.expenseRows}
                            otherManpowerRows={ctx.otherManpowerRows}
                            otherExpenseRows={ctx.otherExpenseRows}
                            monthlyMM={ctx.totalMM}
                            monthlyCr={ctx.totalManpowerCr}
                            directCr={ctx.directCr}
                            contractedCr={ctx.contractedCr}
                            monthlyExpCr={ctx.monthlyExpCr}
                            grandTotal={ctx.grandTotal}
                            totalMM={ctx.aggMM}
                            totalManpowerCr={ctx.aggManpowerCr}
                            totalExpenseCr={ctx.aggExpCr}
                            totalBudgetCr={ctx.aggTotalCr}
                            remarks={{}}
                            onUpdateIgGate={(idx, val) => {
                              handleUpdateIgGate(p.code, idx, val);
                            }}
                            onUpdateEstimation={(cat, idx, val, type) => {
                              if (type === 'manpower') {
                                handleUpdateEstimation(p.code, cat, idx, val, 'manpower', 'Forecast');
                              } else {
                                const isContractedMM = cat === 'Contracted Employee';
                                if (isContractedMM) {
                                  handleUpdateEstimation(p.code, cat, idx, val, 'manpower', 'Forecast');
                                } else {
                                  handleUpdateEstimation(p.code, cat, idx, val * 10000000, 'expense', 'Forecast');
                                }
                              }
                            }}
                            onUpdateRemark={() => {}}
                            canEdit={!isProjectPartLocked(p, 'Forecast') && mode === 'Forecast'}
                            isLocked={isProjectPartLocked(p, 'Forecast')}
                            mode="Forecast"
                            showRemarks={false}
                            isAdmin={false}
                            currentMonthIndex={currentMonthIndex}
                            monthLocks={isPMOForecastGloballyLocked ? new Array(12).fill(true) : (masterConfig.forecastMonthLocks?.[targetFY] || [])}
                          />
                        </table>
                      </div>
                    );
                  })()}

                  {(activeInnerTab[p.code] || 'info') === 'analytics' && (() => {
                    const analyticsCtx = getProjectRowsData(p, mode as FiscalMode);
                    return (
                      <div className="p-8 bg-white grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                        {/* Top Row */}
                        <div className="bg-[#001e3c] p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-900/20 flex flex-col justify-between">
                          <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-6">Financial Summary</h5>
                          <div className="space-y-6">
                              <div>
                                    <span className="text-[8px] font-black text-indigo-400 uppercase block mb-1">TOTAL PROJECT BUDGET</span>
                                 <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black font-mono tracking-tighter">₹{formatCr(p.portfolioBudgetCr)}</span>
                                 </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <span className="text-[8px] font-black text-indigo-400 uppercase block mb-1">ACTUAL SPENT</span>
                                    <span className="text-lg font-black font-mono tracking-tighter">₹{formatCr(p.actualSpentCr)}</span>
                                 </div>
                                 <div>
                                    <span className="text-[8px] font-black text-indigo-400 uppercase block mb-1">REMAINING</span>
                                    <span className="text-lg font-black font-mono tracking-tighter text-emerald-400">₹{formatCr(p.remaining)}</span>
                                 </div>
                              </div>
                              {(mode !== 'Budget' || p.budgetMode === 'fixed') && (
                                <div className="pt-4">
                                   <div className="flex justify-between text-[8px] font-black text-indigo-400 uppercase mb-2">
                                      <span>Budget Utilization</span>
                                      <span>{Math.round(p.burnRate)}%</span>
                                   </div>
                                   <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                      <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${Math.min(p.burnRate, 100)}%` }}
                                         className={`h-full rounded-full ${p.burnRate > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                      />
                                   </div>
                                </div>
                              )}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 h-[350px] flex flex-col lg:col-span-2">
                          <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center">
                            <div className="w-1.5 h-4 bg-orange-500 rounded-full mr-3"></div>
                            Monthly Resource Load
                          </h5>
                          <div className="flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={months.map((m, idx) => ({ name: m, fte: analyticsCtx.totalMM[idx] }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                                <Bar dataKey="fte" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Bottom Row */}
                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 h-[300px] flex flex-col">
                          <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center">
                            <div className="w-1.5 h-4 bg-indigo-600 rounded-full mr-3"></div>
                            Cost Composition
                          </h5>
                          <div className="flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Manpower', value: analyticsCtx.aggManpowerCr },
                                    { name: 'Expenses', value: analyticsCtx.aggExpCr }
                                  ]}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  <Cell fill="#4f46e5" />
                                  <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 h-[300px] flex flex-col">
                          <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center">
                            <div className="w-1.5 h-4 bg-orange-500 rounded-full mr-3"></div>
                            Monthly Expense Load
                          </h5>
                          <div className="flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={months.map((m, idx) => ({ name: m, expense: analyticsCtx.monthlyExpCr[idx] }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                                <Bar dataKey="expense" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 h-[300px] flex flex-col shadow-sm">
                          <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center">
                            <div className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></div>
                            Efficiency Metrics
                          </h5>
                          <div className="space-y-6">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Avg. Monthly Burn</span>
                                  <span className="text-xs font-black text-slate-900 font-mono">₹{formatCr(p.actualSpentCr / (months.length || 1))}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Peak Manpower</span>
                                  <span className="text-xs font-black text-slate-900 font-mono">{Math.max(...analyticsCtx.totalMM).toFixed(2)} FTE</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Avg. Rate / MM</span>
                                  <span className="text-xs font-black text-slate-900 font-mono">₹{formatCr(analyticsCtx.aggMM > 0 ? (analyticsCtx.aggManpowerCr * 10000000) / analyticsCtx.aggMM : 0)}</span>
                              </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {(activeInnerTab[p.code] || 'info') === 'allocation' && (
                    <div className="animate-fadeIn">
                      <ResourceAllocationTab 
                        project={p}
                        mode={((mode as any) === 'Budget' || (mode as any) === 'PMO' ? 'PMO_Budget' : mode) as any}
                        employees={pmoEmployees}
                        months={months}
                        monthIndices={monthIndices}
                        globalUtilization={globalResourceUtilization}
                        onUpdateAllocation={(skill, email, monthlyAllocs, empInfo) => {
                          handleUpdateResourceAllocation(p.code, skill, email, monthlyAllocs, empInfo);
                        }}
                        isLocked={isResourceAllocationLockedForProject(p)}
                      />
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'team' && (
                    <div className="animate-fadeIn p-4 border bg-white m-4 rounded-2xl">
                      <ProjectTeamView 
                        project={p} 
                        employees={pmoEmployees} 
                        selectedFY={selectedFY} 
                        projects={existingProjects} 
                        mode={mode as any}
                      />
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'roster' && (
                    <div className="animate-fadeIn p-4 border bg-white m-4 rounded-2xl">
                      <EmployeeRoster 
                        employees={pmoEmployees} 
                        projects={[p]} 
                        months={months} 
                        selectedFY={selectedFY} 
                        mode={mode as any} 
                        hideMetricsRow={true}
                      />
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'employeeAnalysis' && (
                    <div className="animate-fadeIn p-4 border bg-white m-4 rounded-2xl">
                      <EmployeeAnalysis 
                        employees={pmoEmployees} 
                        projects={[p]} 
                        allProjects={existingProjects}
                        months={months} 
                        selectedFY={selectedFY} 
                        mode={mode as any} 
                        hideMetricsRow={true}
                      />
                    </div>
                  )}

                  {(activeInnerTab[p.code] || 'info') === 'expenseList' && (
                    <div className="animate-fadeIn p-4 border bg-white m-4 rounded-2xl">
                      <ExpenseList 
                        projects={[p]} 
                        months={months} 
                        mode={mode as any} 
                        selectedFY={selectedFY} 
                        isSingleProject={true} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })
      ) : processedProjects.unfiltered.length > 0 ? (
        <div className="bg-white border border-slate-200 text-slate-500 px-4 py-20 rounded-xl text-sm font-medium text-center flex flex-col items-center justify-center space-y-4 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No Matching Projects</h3>
            <p className="mt-1 text-slate-500 uppercase text-[10px] font-bold tracking-widest leading-relaxed">We couldn't find any projects matching your current filters.<br/>Try adjusting your criteria or search term.</p>
          </div>
          <button 
            onClick={() => setFilters({ search: '', projectId: ['All'], vertical: ['All'], domain: ['All'], bu: ['All'], customer: ['All'], projectType: ['All'], tbc: ['Yes'], category: ['All'], family: ['All'], pdh: ['All'], generation: ['All'] })}
            className="mt-4 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            Clear All Filters
          </button>
        </div>
      ) : null}
    </div>
      )}
    </div>
  );
};

export default PMO;
