
import ExcelJS from "exceljs";
const RUPEE_FMT = '"₹"#,##0.00';
const NAVY_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F172A" },
  
};
import * as XLSX from "xlsx";
import LZString from "lz-string";
import {
  ProjectData,
  MasterConfigState,
  FiscalYear,
  FiscalMode,
  MANPOWER_CATEGORIES,
  RESOURCE_SKILLS,
  EXPENSE_CATEGORIES,
  TbcStatus,
  RemarkEntry,
  Employee,
  generateUUID,
  getMultiYearMonths,
  getAbsoluteMonthIndex,
} from "../types";
import {
  RATE_PER_HOUR,
  HOURS_PER_MONTH,
  CONTRACTED_EMPLOYEE_RATE,
  SKILL_MAPPING,
  EXPENSE_MAPPING,
  MAX_MONTHS,
  getStorageKey,
  normalizeSkill,
  ALL_FISCAL_YEARS,
  isSummaryOrCalculatedLabel,
  classifyCategory
} from "../constants";
import { syncService } from "./syncService";

const IG_GATE_OPTIONS = [
  "TBD",
  "NA",
  "IG 0",
  "IG 1",
  "IG 2",
  "IG 3",
  "IG 4",
  "IG 5",
  "IG 6",
  "IG 7",
  "IG 8",
  "IG 9",
];

const isNew = (cat: string) => (cat || "").trim().toLowerCase().includes("new");
const isCO = (cat: string) =>
  (cat || "").trim().toLowerCase().includes("carry");

const isStrategic = (p: ProjectData) => {
  const isIVI = p.productFamily === "IVI" && isNew(p.category);
  const isAE = p.productFamily === "Auto Expo";
  const isInitiaAdd = p.productFamily === "INITIA" && isNew(p.category);
  return isIVI || isAE || isInitiaAdd;
};

const toCrs = (inr: number) => inr / 10000000;

const getColLetter = (colIndex: number) => {
  let letter = "";
  while (colIndex > 0) {
    const mod = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
};

const parseExcelDate = (dateVal: any, monthNames: string[]): Date | null => {
  if (dateVal === undefined || dateVal === null || dateVal === "") return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === "number")
    return new Date(Math.round((dateVal - 25569) * 86400 * 1000));

  const dateStr = String(dateVal).trim();
  const parts = dateStr
    .toLowerCase()
    .split(/[-/\s.]/)
    .filter((p) => p.length > 0);
  
  if (parts.length >= 2) {
    let d = 1, m = -1, y = -1;
    
    // Check for month names (e.g., "Jan", "Feb", etc.)
    const monthIdx = parts.findIndex(p => monthNames.some(mn => p.startsWith(mn)));
    if (monthIdx !== -1) {
      m = monthNames.findIndex(mn => parts[monthIdx].startsWith(mn));
      if (parts.length === 3) {
        // Assume format like 21-Dec-71 (DD-MMM-YY) or Dec-21-71 (MMM-DD-YY)
        if (monthIdx === 0) { // MMM-DD-YY
          d = parseInt(parts[1]);
          y = parseInt(parts[2]);
        } else if (monthIdx === 1) { // DD-MMM-YY
          d = parseInt(parts[0]);
          y = parseInt(parts[2]);
        } else { // YY-MM-DD or something else where Month is last
          d = parseInt(parts[1]);
          y = parseInt(parts[0]);
        }
      } else { // 2 parts: MMM-YY or YY-MMM
        y = parseInt(parts[monthIdx === 0 ? 1 : 0]);
        d = 1;
      }
    } else if (parts.length >= 2) {
      // Numeric formats: DD-MM-YYYY or YYYY-MM-DD or MM-DD-YYYY
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      const p2 = parts.length > 2 ? parseInt(parts[2]) : -1;

      if (p2 > 0) { // 3 parts: p0-p1-p2
        if (p2 > 1000) { // Assume DD-MM-YYYY or MM-DD-YYYY
           y = p2;
           if (p0 > 12) { d = p0; m = p1 - 1; }
           else { m = p0 - 1; d = p1; }
        } else if (p0 > 1000) { // Assume YYYY-MM-DD
           y = p0;
           m = p1 - 1;
           d = p2;
        } else { // Assume DD-MM-YY or MM-DD-YY
           y = p2 + (p2 < 30 ? 2000 : 1900);
           if (p0 > 12) { d = p0; m = p1 - 1; }
           else { m = p0 - 1; d = p1; }
        }
      } else { // 2 parts: MM-YYYY or YYYY-MM
        if (p1 > 1000) { m = p0 - 1; y = p1; }
        else if (p0 > 1000) { y = p0; m = p1 - 1; }
        d = 1;
      }
    }

    if (m >= 0 && m <= 11 && !isNaN(y) && !isNaN(d)) {
      if (y < 100) y += (y < 30 ? 2000 : 1900);
      return new Date(Date.UTC(y, m, d));
    }
  }

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const parseCellValue = (val: any): number => {
  if (typeof val === "number") return val;
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/[^0-9.%-]/g, "");
  if (clean.includes("%"))
    return (parseFloat(clean.replace("%", "")) || 0) / 100;
  return parseFloat(clean || "0") || 0;
};

const drawChartToCanvas = (
  type: "manpower" | "expense",
  months: string[],
  activeConsolidations: any,
  sortedKeys: string[]
): string => {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 650;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const DISTINCT_COLORS = [
      "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
      "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#d946ef",
      "#84cc16", "#14b8a6", "#f43f5e", "#0ea5e9", "#fbbf24",
      "#a855f7", "#22c55e", "#64748b", "#475569", "#334155"
    ];

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Padding
    const paddingLeft = 85;
    const paddingRight = 320;
    const paddingTop = 90;
    const paddingBottom = 60;
    const plotWidth = canvas.width - paddingLeft - paddingRight;
    const plotHeight = canvas.height - paddingTop - paddingBottom;

    const monthsCount = months && months.length > 0 ? months.length : 12;
    const monthWidth = plotWidth / monthsCount;
    const barWidth = Math.max(6, monthWidth * 0.32);
    const colGap = Math.max(2, monthWidth * 0.04);

    const consBudget = activeConsolidations?.["Budget"] || { manpowerData: {}, expenseData: {}, totalDirectManpowerMM: [], totalManpowerMM: [], totalExpenseCr: [] };
    const consActuals = activeConsolidations?.["Actuals"] || { manpowerData: {}, expenseData: {}, totalDirectManpowerMM: [], totalManpowerMM: [], totalExpenseCr: [] };

    // 1. Calculate Max Y
    let maxVal = 0;
    for (let i = 0; i < monthsCount; i++) {
      let budgetStack = 0;
      let actualsStack = 0;
      
      if (type === "manpower") {
        sortedKeys.forEach(key => {
          budgetStack += consBudget?.manpowerData?.[key]?.[i] || 0;
          actualsStack += consActuals?.manpowerData?.[key]?.[i] || 0;
        });
        // Line values
        const budgetLine = consBudget?.totalDirectManpowerMM?.[i] || 0;
        const actualsLine = consActuals?.totalManpowerMM?.[i] || 0;
        maxVal = Math.max(maxVal, budgetStack, actualsStack, budgetLine, actualsLine);
      } else {
        // Expense - filter out 'Contracted Employee'
        const expenseKeys = sortedKeys.filter(k => k !== "Contracted Employee");
        expenseKeys.forEach(key => {
          budgetStack += consBudget?.expenseData?.[key]?.[i] || 0;
          actualsStack += consActuals?.expenseData?.[key]?.[i] || 0;
        });
        // Line values
        const budgetLine = consBudget?.totalExpenseCr?.[i] || 0;
        const actualsLine = consActuals?.totalExpenseCr?.[i] || 0;
        maxVal = Math.max(maxVal, budgetStack, actualsStack, budgetLine, actualsLine);
      }
    }

    // Set clean yMax
    let yMax = 10;
    if (maxVal > 0) {
      const rawMax = maxVal * 1.15; // 15% padding at top
      if (rawMax < 1) {
        yMax = Math.ceil(rawMax * 10) / 10;
      } else if (rawMax < 10) {
        yMax = Math.ceil(rawMax);
      } else if (rawMax < 100) {
        yMax = Math.ceil(rawMax / 10) * 10;
      } else {
        yMax = Math.ceil(rawMax / 50) * 50;
      }
    }
    if (yMax <= 0) yMax = 10;
    const scaleY = plotHeight / yMax;

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const cleanHex = hex.replace("#", "");
      const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
      const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
      const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // 2. Draw horizontal grid lines
    const gridCount = 5;
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let g = 0; g <= gridCount; g++) {
      const yVal = (yMax / gridCount) * g;
      const yPos = canvas.height - paddingBottom - yVal * scaleY;
      
      // Grid Line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yPos);
      ctx.lineTo(paddingLeft + plotWidth, yPos);
      ctx.stroke();

      // Label
      const labelText = type === "manpower" ? yVal.toFixed(1) : `₹${yVal.toFixed(2)}`;
      ctx.fillText(labelText, paddingLeft - 10, yPos);
    }

    // 3. Draw stacked bars
    const keysToUse = type === "manpower" 
      ? sortedKeys 
      : sortedKeys.filter(k => k !== "Contracted Employee");

    for (let i = 0; i < monthsCount; i++) {
      const monthCenterX = paddingLeft + (i + 0.5) * monthWidth;
      const xBudget = monthCenterX - barWidth - colGap / 2;
      const xActuals = monthCenterX + colGap / 2;

      // Draw Budget Stack
      let currentYBudget = canvas.height - paddingBottom;
      keysToUse.forEach((key, kIdx) => {
        const val = type === "manpower"
          ? consBudget?.manpowerData?.[key]?.[i] || 0
          : consBudget?.expenseData?.[key]?.[i] || 0;
        if (val > 0) {
          const segHeight = val * scaleY;
          const baseColor = DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length];
          
          ctx.fillStyle = hexToRgba(baseColor, 0.35);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          
          ctx.beginPath();
          ctx.rect(xBudget, currentYBudget - segHeight, barWidth, segHeight);
          ctx.fill();
          ctx.stroke();
          
          currentYBudget -= segHeight;
        }
      });

      // Draw Actuals Stack
      let currentYActuals = canvas.height - paddingBottom;
      keysToUse.forEach((key, kIdx) => {
        const val = type === "manpower"
          ? consActuals?.manpowerData?.[key]?.[i] || 0
          : consActuals?.expenseData?.[key]?.[i] || 0;
        if (val > 0) {
          const segHeight = val * scaleY;
          const baseColor = DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length];
          
          ctx.fillStyle = baseColor;
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          
          ctx.beginPath();
          ctx.rect(xActuals, currentYActuals - segHeight, barWidth, segHeight);
          ctx.fill();
          
          currentYActuals -= segHeight;
        }
      });

      // Draw X-axis label
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(months[i] || "", monthCenterX, canvas.height - paddingBottom + 12);
    }

    // 4. Draw Totals Comparison Lines
    const drawComparisonLine = (mode: "Budget" | "Actuals") => {
      const isBudget = mode === "Budget";
      const color = mode === "Actuals" ? "#0f172a" : "#64748b";
      const cons = activeConsolidations?.[mode];
      if (!cons) return;
      
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      if (isBudget) {
        ctx.setLineDash([6, 6]);
      } else {
        ctx.setLineDash([]);
      }

      let firstPoint = true;
      for (let i = 0; i < monthsCount; i++) {
        const x = paddingLeft + (i + 0.5) * monthWidth;
        const val = type === "manpower"
          ? (isBudget ? cons?.totalDirectManpowerMM?.[i] : cons?.totalManpowerMM?.[i]) || 0
          : cons?.totalExpenseCr?.[i] || 0;
        const y = canvas.height - paddingBottom - val * scaleY;

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw Dots
      ctx.setLineDash([]);
      for (let i = 0; i < monthsCount; i++) {
        const x = paddingLeft + (i + 0.5) * monthWidth;
        const val = type === "manpower"
          ? (isBudget ? cons?.totalDirectManpowerMM?.[i] : cons?.totalManpowerMM?.[i]) || 0
          : cons?.totalExpenseCr?.[i] || 0;
        const y = canvas.height - paddingBottom - val * scaleY;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    drawComparisonLine("Budget");
    drawComparisonLine("Actuals");

    // 5. Draw Legend
    ctx.setLineDash([]);
    const legendX = canvas.width - paddingRight + 40;
    let legendY = paddingTop + 10;
    
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Section Title for Stacks
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(type === "manpower" ? "MANPOWER CATEGORIES" : "EXPENSE CATEGORIES", legendX, legendY);
    legendY += 20;

    keysToUse.forEach((key, kIdx) => {
      const baseColor = DISTINCT_COLORS[kIdx % DISTINCT_COLORS.length];
      
      // Draw small round dot
      ctx.beginPath();
      ctx.arc(legendX + 6, legendY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = baseColor;
      ctx.fill();

      // Label
      ctx.fillStyle = "#1e293b";
      ctx.font = "9px sans-serif";
      ctx.fillText(key, legendX + 20, legendY);
      
      legendY += 16;
    });

    legendY += 12;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("COMPARISON LINES", legendX, legendY);
    legendY += 20;

    // Budget Total Line Legend
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 25, legendY);
    ctx.stroke();
    
    // Dot in middle
    ctx.beginPath();
    ctx.arc(legendX + 12.5, legendY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#64748b";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = "#1e293b";
    ctx.font = "9px sans-serif";
    ctx.fillText(type === "manpower" ? "TOTAL BUDGET (MM)" : "TOTAL BUDGET (CR)", legendX + 35, legendY);

    legendY += 22;

    // Actuals Total Line Legend
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 25, legendY);
    ctx.stroke();
    
    // Dot in middle
    ctx.beginPath();
    ctx.arc(legendX + 12.5, legendY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#1e293b";
    ctx.font = "9px sans-serif";
    ctx.fillText(type === "manpower" ? "TOTAL ACTUALS (MM)" : "TOTAL ACTUALS (CR)", legendX + 35, legendY);

    // 6. Draw Chart Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(type === "manpower" ? "Manpower Distribution (MM)" : "Expense Distribution (Cr)", paddingLeft, 35);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.fillText(
      type === "manpower"
        ? "Monthly personnel allocations in person-months comparing Budget vs Actuals"
        : "Monthly operational expenses comparing Budget vs Actuals",
      paddingLeft,
      55
    );

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("drawChartToCanvas error:", err);
    return "";
  }
};

const identifySheetHeaders = (sheetRows: any[][]) => {
  const colIndices: any = {
    code: -1,
    name: -1,
    month: -1,
    hours: -1,
    amount: -1,
    bucket: -1,
    type: -1,
    skill: -1,
    vertical: -1,
    creatType: -1,
    productFamily: -1,
    monthPriority: 0,
    amountFound: false,
    isFlatList: false,
  };

  const headerRowIdx = sheetRows.findIndex(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => {
        const s = String(cell || "").toLowerCase();
        return (
          s.includes("project code") ||
          s.includes("project name") ||
          s.includes("record type") ||
          s.includes("role hr master 2") ||
          s.includes("functional unit") ||
          s === "month" ||
          s === "hours" ||
          s === "amount"
        );
      }),
  );

  if (headerRowIdx !== -1) {
    const headerRow = sheetRows[headerRowIdx] || [];
    headerRow.forEach((cell, idx) => {
      const s = String(cell || "")
        .toLowerCase()
        .trim();
      if (
        s.includes("project code") ||
        s === "code" ||
        s === "id" ||
        s === "project_code"
      )
        colIndices.code = idx;
      if (s.includes("project name") || s === "name" || s === "project_name")
        colIndices.name = idx;
      if (s === "month" || s === "month-year" || s === "month year") {
        colIndices.month = idx;
        colIndices.monthPriority = 2;
      } else if (
        (s === "date" || s === "period" || s === "month") &&
        colIndices.monthPriority < 2
      ) {
        colIndices.month = idx;
        colIndices.monthPriority = 1;
      }
      if (
        s === "hours" ||
        s === "working hours" ||
        s === "billable hours" ||
        s === "hrs"
      )
        colIndices.hours = idx;
      else if (
        (s === "quantity" || s === "qty" || s === "units") &&
        colIndices.hours === -1
      )
        colIndices.hours = idx;
      if (
        s === "amount" ||
        s === "value" ||
        s === "cost" ||
        s === "total" ||
        s.includes("expense amount") ||
        s.includes("total expense") ||
        s === "actuals" ||
        s.includes("total cost") ||
        s.includes("net cost") ||
        s.includes("manpower cost")
      ) {
        if (
          s.includes("total expense") ||
          s.includes("total cost") ||
          s.includes("net cost") ||
          !colIndices.amountFound
        ) {
          colIndices.amount = idx;
          colIndices.amountFound = true;
        }
      }
      if (s.includes("expense bucket") || s === "bucket" || s === "category")
        colIndices.bucket = idx;
      if (s.includes("record type") || s === "type" || s === "record_type")
        colIndices.type = idx;
      if (
        s.includes("role hr master 2") ||
        s === "skill" ||
        s.includes("functional unit") ||
        s === "label" ||
        s === "role" ||
        s === "designation"
      )
        colIndices.skill = idx;
      if (s === "vertical") colIndices.vertical = idx;
      if (s === "creat type" || s === "creat_type" || s === "type")
        colIndices.creatType = idx;
      if (
        s.includes("product family") ||
        s.includes("product_family") ||
        s.includes("family")
      )
        colIndices.productFamily = idx;
      if (
        s === "task" ||
        s === "task name" ||
        s === "task_name" ||
        s === "activity" ||
        s === "activity name" ||
        s === "task_description" ||
        s === "description"
      ) {
        if (colIndices.task === -1 || s === "task" || s === "task name")
          colIndices.task = idx;
      }
      if (
        s === "task list" ||
        s === "task_list" ||
        s === "tasklist" ||
        s === "activity list" ||
        s === "activity_list" ||
        s === "task_group"
      ) {
        if (colIndices.taskList === -1 || s === "task list")
          colIndices.taskList = idx;
      }
    });
  }
  return { colIndices, headerRowIdx };
};

const applyStandardHeader = (row: ExcelJS.Row) => {
  row.height = 30;
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  row.fill = NAVY_HEADER_FILL;
  row.alignment = { vertical: "middle", horizontal: "center" };
};

const getAuthoritativeRow = (p: ProjectData, cat: string, pmoData: any, rowsData: any): number[] => {
  const parseRow = (data: any): number[] => {
    if (Array.isArray(data)) {
      if (data.length < MAX_MONTHS) {
        const arr = new Array(MAX_MONTHS).fill(0);
        data.forEach((v, i) => { if (i < MAX_MONTHS) arr[i] = v; });
        return arr;
      }
      return data;
    }
    const arr = new Array(MAX_MONTHS).fill(0);
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        const idx = parseInt(k);
        if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) {
          arr[idx] = Number(v) || 0;
        }
      });
    }
    return arr;
  };

  const pmoRow = parseRow(pmoData);
  if (pmoRow.some((v) => v !== 0)) {
    return pmoRow;
  }

  const rowData = parseRow(rowsData);
  if (rowData.some((v) => v !== 0)) {
    return rowData;
  }

  // Fallback to skills / expenses properties (for original budget backup)
  const skillsRow = parseRow(p.skills?.[cat]);
  if (skillsRow.some((v) => v !== 0)) {
    return skillsRow;
  }
  const expensesRow = parseRow(p.expenses?.[cat]);
  if (expensesRow.some((v) => v !== 0)) {
    return expensesRow;
  }
  
  // Fallback to employeeSkills
  if (p.employeeSkills && p.employeeSkills[cat]) {
    const sumRow = Array(MAX_MONTHS).fill(0);
    Object.values(p.employeeSkills[cat]).forEach((allocs: any) => {
      const arr = parseRow(allocs);
      arr.forEach((val, i) => {
        if (i < MAX_MONTHS) sumRow[i] += (val || 0);
      });
    });
    if (sumRow.some(v => v !== 0)) {
      return sumRow;
    }
  }

  if (pmoRow.length > 0) {
    return pmoRow;
  }
  if (rowData.length > 0) {
    return rowData;
  }
  return Array(MAX_MONTHS).fill(0);
};

/**
 * EXPORT LOGIC - RESOURCE REGISTRY
 */
export const exportResourceRegistry = async (
  employees: Employee[],
  projects: ProjectData[],
  config: MasterConfigState,
) => {
  const workbook = new ExcelJS.Workbook();

  // Prepare Validation Data (Sheet created at end to ensure it's last)
  const projectList = (projects || [])
    .map((p) => `${p.code}: ${p.name}`)
    .sort();

  const validationData = [
    { col: 1, header: "Verticals", values: config?.verticals || [] },
    { col: 2, header: "Categories", values: config?.employeeCategories || [] },
    { col: 3, header: "Bands", values: config?.bands || [] },
    { col: 4, header: "Locations", values: config?.locations || [] },
    { col: 5, header: "SkillsL1", values: RESOURCE_SKILLS || [] },
    { col: 6, header: "SkillsL2", values: config?.skillLevelsL2 || [] },
    { col: 7, header: "Families", values: config?.productFamilies || [] },
    { col: 8, header: "Teams", values: config?.functionalTeams || [] },
    { col: 9, header: "Projects", values: ["Unallocated", ...projectList] },
    { col: 10, header: "CoreSkills", values: MANPOWER_CATEGORIES || [] },
  ];

  const getValidationFormula = (header: string) => {
    const item = validationData.find((d) => d.header === header);
    if (!item) return "";
    const letter = getColLetter(item.col);
    return `_DataValidation!$${letter}$2:$${letter}$${(item.values || []).length + 1}`;
  };

  // 1. Employee List Sheet
  const empSheet = workbook.addWorksheet("Employee List");
  const headers = [
    "System ID",
    "Emp ID",
    "Name",
    "Email-ID",
    "Active/Inactive",
    "Vertical",
    "Functional Team",
    "Category",
    "Band",
    "Location",
    "Skill L1",
    "Skill L2",
    "PR Manager ID",
    "FR Manager ID",
    "Product Family",
    "Project Allocation",
    "Gender",
    "Date of Birth",
    "Date of Joining",
    "Remarks",
  ];

  const headerRow = empSheet.addRow(headers);
  applyStandardHeader(headerRow);

  // Hide System ID
  empSheet.getColumn(1).hidden = true;

  // Set Column Widths
  empSheet.columns.forEach((col, i) => {
    if (i === 0)
      col.width = 0; // System ID
    else if (i === 2)
      col.width = 30; // Name
    else if (i === 3)
      col.width = 30; // Email-ID
    else if (i === 4)
      col.width = 15; // Active/Inactive
    else if (i === 15)
      col.width = 40; // Project Allocation
    else if (i === 16)
      col.width = 40; // Remarks
    else col.width = 20;
  });

  // Add Data Rows
  employees.forEach((e) => {
    const p = projects.find((proj) => proj.id === e.allocatedProjectId);
    empSheet.addRow([
      e.id,
      e.empId,
      e.name,
      e.email || "",
      e.status || "Active",
      e.vertical,
      e.functionalTeam || "NA",
      e.category,
      e.band,
      e.location,
      e.skill,
      e.skillLevel2,
      e.prmId || "",
      e.frmId || "",
      e.productFamily,
      p ? `${p.code}: ${p.name}` : "", // Project Allocation
      e.gender || "NA",
      e.dateOfBirth || "",
      e.dateOfJoining || "",
      e.remarks || "",
    ]);
  });

  // Define Data Validations only for rows containing data
  const rowCount = employees.length + 1;

  for (let r = 2; r <= rowCount; r++) {
    empSheet.getCell(`E${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Active,Inactive"'],
    }; // Active/Inactive
    empSheet.getCell(`F${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Verticals")],
    }; // Vertical
    empSheet.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Teams")],
    }; // Functional Team
    empSheet.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Categories")],
    }; // Category
    empSheet.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Bands")],
    }; // Band
    empSheet.getCell(`J${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Locations")],
    }; // Location
    empSheet.getCell(`K${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("SkillsL1")],
    }; // Skill L1
    empSheet.getCell(`L${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("SkillsL2")],
    }; // Skill L2
    empSheet.getCell(`O${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [getValidationFormula("Families")],
    }; // Product Family
    empSheet.getCell(`Q${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Male,Female,Other"'],
    }; // Gender
  }

  // Add Helper Columns (Calculated via Formula)
  // Col U (21) -> SkillGroup (CORE/SUPPORT)
  for (let r = 2; r <= rowCount; r++) {
    // SkillGroup: Check if Skill L1 (K) is in CoreSkills list
    empSheet.getCell(`U${r}`).value = {
      formula: `IF($B${r}<>"", IF(ISNUMBER(MATCH($K${r},${getValidationFormula("CoreSkills")},0)),"CORE","SUPPORT"), "")`,
    };
  }

  // Hide Helper Columns
  empSheet.getColumn(21).hidden = true;

  // 2. Resource Matrix Sheet
  const matrixSheet = workbook.addWorksheet("Resource Matrix");

  // Style Helpers
  const addSectionHeader = (title: string) => {
    const row = matrixSheet.addRow([title]);
    row.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    }; // Slate 900
    matrixSheet.mergeCells(
      row.number,
      1,
      row.number,
      (config.verticals?.length || 0) + 2,
    );
  };

  const addSubHeader = (headers: string[]) => {
    const row = matrixSheet.addRow(headers);
    row.font = { bold: true, color: { argb: "FF64748B" } }; // Slate 500
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    }; // Slate 100
    row.alignment = { horizontal: "center" };
    row.getCell(1).alignment = { horizontal: "left" };
  };

  // --- SUMMARY SECTION ---
  addSectionHeader("CREAT RESOURCE SUMMARY");

  const summaryHeaderRow = matrixSheet.addRow([
    "Category",
    "Internal",
    "External",
    "Total",
  ]);
  summaryHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  summaryHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  }; // Indigo 600

  const summaryCategories = [
    { label: "Core Staff (R&D)", group: "CORE" },
    { label: "Support Functions", group: "SUPPORT" },
  ];

  let summaryStartRow = matrixSheet.rowCount + 1;

  summaryCategories.forEach((cat) => {
    const r = matrixSheet.addRow([cat.label]);
    const rNum = r.number;
    // Internal: Group=R(cat.group), Category (H) does not contain INTERN or CONSULTANT, Status (E) is Active
    r.getCell(2).value = {
      formula: `COUNTIFS('Employee List'!$R:$R,"${cat.group}",'Employee List'!$H:$H,"<>*Intern*",'Employee List'!$H:$H,"<>*Consultant*",'Employee List'!$E:$E,"Active")`,
    };
    // External: Group=R(cat.group), Category (H) does not contain INTERN but contains CONSULTANT, Status (E) is Active
    r.getCell(3).value = {
      formula: `COUNTIFS('Employee List'!$R:$R,"${cat.group}",'Employee List'!$H:$H,"<>*Intern*",'Employee List'!$H:$H,"*Consultant*",'Employee List'!$E:$E,"Active")`,
    };
    // Total
    r.getCell(4).value = { formula: `SUM(B${rNum}:C${rNum})` };
  });

  // Consolidated
  const consRow = matrixSheet.addRow(["Consolidated Aggregate"]);
  consRow.font = { bold: true };
  consRow.getCell(2).value = {
    formula: `SUM(B${summaryStartRow}:B${matrixSheet.rowCount - 1})`,
  };
  consRow.getCell(3).value = {
    formula: `SUM(C${summaryStartRow}:C${matrixSheet.rowCount - 1})`,
  };
  consRow.getCell(4).value = {
    formula: `SUM(D${summaryStartRow}:D${matrixSheet.rowCount - 1})`,
  };

  // Interns: Category (H) contains INTERN, Status (E) is Active
  const intRow = matrixSheet.addRow(["Interns"]);
  // Internal Interns: Category (H) contains INTERN, not CONSULTANT
  intRow.getCell(2).value = {
    formula: `COUNTIFS('Employee List'!$H:$H,"*Intern*",'Employee List'!$H:$H,"<>*Consultant*",'Employee List'!$E:$E,"Active")`,
  };
  // External Interns: Category (H) contains INTERN and CONSULTANT
  intRow.getCell(3).value = {
    formula: `COUNTIFS('Employee List'!$H:$H,"*Intern*",'Employee List'!$H:$H,"*Consultant*",'Employee List'!$E:$E,"Active")`,
  };
  intRow.getCell(4).value = {
    formula: `SUM(B${intRow.number}:C${intRow.number})`,
  };

  // Grand Total
  const grandRow = matrixSheet.addRow(["GRAND TOTAL"]);
  grandRow.font = { bold: true, color: { argb: "FF4F46E5" } };
  grandRow.getCell(2).value = {
    formula: `B${consRow.number} + B${intRow.number}`,
  };
  grandRow.getCell(3).value = {
    formula: `C${consRow.number} + C${intRow.number}`,
  };
  grandRow.getCell(4).value = {
    formula: `D${consRow.number} + D${intRow.number}`,
  };

  matrixSheet.addRow([]); // Spacer

  // --- MAIN MATRIX (EXCL. INTERNS) ---
  addSectionHeader("Main Resource Matrix (Excl. Interns)");

  const verts = config?.verticals || [];
  const matrixHeaders = ["Skill Category", "Aggregate", ...verts];
  const mainHeaderRow = matrixSheet.addRow(matrixHeaders);
  const mainHeaderRowNum = mainHeaderRow.number;
  mainHeaderRow.font = { bold: true, color: { argb: "FF64748B" } };
  mainHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const getCellFormula = (baseConditions: string[]) => {
    // Fix: Add check for non-empty Emp ID (Column B) to prevent counting blank rows
    // Also ensure 'Active' status is always checked here (Column E)
    const baseWithIdCheck = [
      `'Employee List'!$B:$B, "<>"`,
      `'Employee List'!$E:$E, "Active"`,
      ...baseConditions,
    ];

    // Total (Excl Interns)
    const conditionsTotal = [
      ...baseWithIdCheck,
      `'Employee List'!$F:$F, "<>*Intern*"`,
    ].join(",");
    const countTotal = `COUNTIFS(${conditionsTotal})`;

    // Consultants (Excl Interns, Is Consultant)
    const conditionsCons = [
      ...baseWithIdCheck,
      `'Employee List'!$F:$F, "<>*Intern*"`,
      `'Employee List'!$F:$F, "*Consultant*"`,
    ].join(",");
    const countCons = `COUNTIFS(${conditionsCons})`;

    // Format: "Total (ConsultantCount)" or "0"
    return `IF(${countTotal} > 0, ${countTotal} & " (" & ${countCons} & ")", 0)`;
  };

  const setLeftAlign = (row: ExcelJS.Row) => {
    for (let c = 2; c <= matrixHeaders.length; c++) {
      row.getCell(c).alignment = { horizontal: "left" };
    }
  };

  // Core Rows
  MANPOWER_CATEGORIES.forEach((skill) => {
    const row = matrixSheet.addRow([skill]);

    // Aggregate: Skill Match (Skill L1 is now Column K)
    const aggArgs = [`'Employee List'!$K:$K, "${skill}"`];
    row.getCell(2).value = { formula: getCellFormula(aggArgs) };

    // Per Vertical: Skill Match + Vertical Match (Vertical is now Column F)
    verts.forEach((v, i) => {
      const colIdx = 3 + i;
      const colLetter = getColLetter(colIdx);
      const vertArgs = [
        `'Employee List'!$K:$K, "${skill}"`,
        `'Employee List'!$F:$F, ${colLetter}$${mainHeaderRowNum}`,
      ];
      row.getCell(colIdx).value = { formula: getCellFormula(vertArgs) };
    });
    setLeftAlign(row);
  });

  // Total Core Row
  const tCoreRow = matrixSheet.addRow(["Total Core (A)"]);
  tCoreRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  }; // Indigo 100
  tCoreRow.font = { bold: true };

  // Total Core Aggregate (Group is now Column R)
  tCoreRow.getCell(2).value = {
    formula: getCellFormula([`'Employee List'!$R:$R, "CORE"`]),
  };

  // Total Core Verticals (Group is now Column R, Vertical is now Column F)
  verts.forEach((v, i) => {
    const colIdx = 3 + i;
    const colLetter = getColLetter(colIdx);
    const vertArgs = [
      `'Employee List'!$R:$R, "CORE"`,
      `'Employee List'!$F:$F, ${colLetter}$${mainHeaderRowNum}`,
    ];
    tCoreRow.getCell(colIdx).value = { formula: getCellFormula(vertArgs) };
  });
  setLeftAlign(tCoreRow);

  // Support Rows
  const supportSkills = RESOURCE_SKILLS.filter(
    (s) => !MANPOWER_CATEGORIES.includes(s),
  );
  supportSkills.forEach((skill) => {
    const row = matrixSheet.addRow([skill]);

    const aggArgs = [`'Employee List'!$K:$K, "${skill}"`];
    row.getCell(2).value = { formula: getCellFormula(aggArgs) };

    verts.forEach((v, i) => {
      const colIdx = 3 + i;
      const colLetter = getColLetter(colIdx);
      const vertArgs = [
        `'Employee List'!$K:$K, "${skill}"`,
        `'Employee List'!$F:$F, ${colLetter}$${mainHeaderRowNum}`,
      ];
      row.getCell(colIdx).value = { formula: getCellFormula(vertArgs) };
    });
    setLeftAlign(row);
  });

  // Total Support Row
  const tSuppRow = matrixSheet.addRow(["Total Support (B)"]);
  tSuppRow.font = { bold: true };
  tSuppRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  // Total Support Aggregate
  tSuppRow.getCell(2).value = {
    formula: getCellFormula([`'Employee List'!$R:$R, "SUPPORT"`]),
  };

  // Total Support Verticals
  verts.forEach((v, i) => {
    const colIdx = 3 + i;
    const colLetter = getColLetter(colIdx);
    const vertArgs = [
      `'Employee List'!$R:$R, "SUPPORT"`,
      `'Employee List'!$D:$D, ${colLetter}$${mainHeaderRowNum}`,
    ];
    tSuppRow.getCell(colIdx).value = { formula: getCellFormula(vertArgs) };
  });
  setLeftAlign(tSuppRow);

  // Total Main
  const tMainRow = matrixSheet.addRow(["TOTAL MAIN"]);
  tMainRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  tMainRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  // Total Main Aggregate (Just Excl Interns - implicit in getCellFormula base args being empty)
  tMainRow.getCell(2).value = { formula: getCellFormula([]) };

  // Total Main Verticals
  verts.forEach((v, i) => {
    const colIdx = 3 + i;
    const colLetter = getColLetter(colIdx);
    const vertArgs = [
      `'Employee List'!$D:$D, ${colLetter}$${mainHeaderRowNum}`,
    ];
    tMainRow.getCell(colIdx).value = { formula: getCellFormula(vertArgs) };
  });
  setLeftAlign(tMainRow);

  matrixSheet.addRow([]);

  // --- INTERN MATRIX ---
  addSectionHeader("Intern Resource Matrix");
  const internHeaderRow = matrixSheet.addRow(matrixHeaders);
  const internHeaderRowNum = internHeaderRow.number;
  internHeaderRow.font = { bold: true, color: { argb: "FF64748B" } };
  internHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  // Combine lists for Interns
  [...MANPOWER_CATEGORIES, ...supportSkills].forEach((skill) => {
    const row = matrixSheet.addRow([skill]);

    // Aggregate: Skill=X, Is Intern, Status=Active
    // Use raw skill string to ensure proper matching
    row.getCell(2).value = {
      formula: `COUNTIFS('Employee List'!$K:$K, "${skill}", 'Employee List'!$H:$H, "*Intern*", 'Employee List'!$E:$E, "Active")`,
    };

    // Verticals: Skill Match + Vertical Match + Is Intern + Status=Active
    verts.forEach((_, i) => {
      const colIdx = 3 + i;
      const colLetter = getColLetter(colIdx);
      // Ensure we are referencing the correct header row for this section (internHeaderRowNum)
      // Use raw skill string
      const formula = `COUNTIFS('Employee List'!$K:$K, "${skill}", 'Employee List'!$F:$F, ${colLetter}$${internHeaderRowNum}, 'Employee List'!$H:$H, "*Intern*", 'Employee List'!$E:$E, "Active")`;
      row.getCell(colIdx).value = { formula };
    });
    setLeftAlign(row);
  });

  const totalInternsRow = matrixSheet.addRow(["Total Interns"]);
  totalInternsRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalInternsRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF064E3B" },
  }; // Dark Green (Emerald 900)

  // Explicit calculation of sum range to avoid any ambiguity
  const internSumStart = internHeaderRowNum + 1;
  const internSumEnd = totalInternsRow.number - 1;

  for (let c = 2; c <= matrixHeaders.length; c++) {
    const colChar = getColLetter(c);
    // Ensure we have a valid range (at least one row) before setting formula, else 0
    if (internSumEnd >= internSumStart) {
      totalInternsRow.getCell(c).value = {
        formula: `SUM(${colChar}${internSumStart}:${colChar}${internSumEnd})`,
      };
    } else {
      totalInternsRow.getCell(c).value = 0;
    }
  }
  setLeftAlign(totalInternsRow);

  matrixSheet.addRow([]);

  // --- LOCATION MATRIX ---
  addSectionHeader("Location-wise Resource Distribution (Excl. Interns)");
  const locHeaderRow = matrixSheet.addRow([
    "Operating Location",
    "Aggregate",
    ...verts,
  ]);
  const locHeaderRowNum = locHeaderRow.number;
  locHeaderRow.font = { bold: true, color: { argb: "FF64748B" } };
  locHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  (config.locations || []).forEach((loc) => {
    const row = matrixSheet.addRow([loc]);
    const rNum = row.number;
    row.getCell(2).value = {
      formula: `COUNTIFS('Employee List'!$J:$J, $A${rNum}, 'Employee List'!$H:$H, "<>*Intern*", 'Employee List'!$E:$E, "Active")`,
    };
    verts.forEach((_, i) => {
      const colIdx = 3 + i;
      const colLetter = getColLetter(colIdx);
      const formula = `COUNTIFS('Employee List'!$J:$J, $A${rNum}, 'Employee List'!$F:$F, ${colLetter}$${locHeaderRowNum}, 'Employee List'!$H:$H, "<>*Intern*", 'Employee List'!$E:$E, "Active")`;
      row.getCell(colIdx).value = { formula };
    });
  });

  // Formatting Columns
  matrixSheet.getColumn(1).width = 35;
  for (let c = 2; c <= matrixHeaders.length; c++)
    matrixSheet.getColumn(c).width = 15;

  // 3. Create _DataValidation Sheet (Moved to LAST to ensure it appears as the final tab)
  const validationSheet = workbook.addWorksheet("_DataValidation");
  validationSheet.state = "hidden";

  validationData.forEach((item) => {
    validationSheet.getCell(1, item.col).value = item.header;
    item.values.forEach((v, i) => {
      validationSheet.getCell(i + 2, item.col).value = v;
    });
  });

  // 4. Generate Download
  const now = new Date();
  const YYYYMMDD = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const HHmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const fileName = `CREAT_Resources_Export_${YYYYMMDD}_${HHmm}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const getProjectsFromStorage = (fy: string, mode: string): ProjectData[] => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const key = getStorageKey(fy, mode);
  const saved = window.localStorage.getItem(key);
  if (!saved) return [];
  try {
    let parsedString = saved;
    if (!saved.startsWith("{") && !saved.startsWith("[")) {
      parsedString = LZString.decompressFromUTF16(saved) || saved;
    }
    const parsed = JSON.parse(parsedString);
    return parsed.projects || [];
  } catch (e) {
    console.error(`Failed to load projects for ${fy} ${mode} in exporter:`, e);
    return [];
  }
};

export const exportProjectRegistry = async (
  projectsInScope: ProjectData[],
  masterConfig: MasterConfigState,
  selectedFY: FiscalYear | null,
  currentMonths: string[],
  fiscalMode: FiscalMode = "Budget",
  isPMOContext = false,
  filters?: any,
  isExplicitSingleProjectExport = false,
) => {
  const fy = selectedFY || "FY 25-26";
  const storageCache: Record<string, ProjectData[]> = {};
  const getProjectsWithCache = async (targetFY: string, mode: string): Promise<ProjectData[]> => {
    let queryFY = targetFY;
    if (queryFY === "All FY" || !queryFY) {
      queryFY = "FY 25-26";
    }
    const cacheKey = `${queryFY}-${mode}`;
    if (storageCache[cacheKey]) {
      return storageCache[cacheKey];
    }
    let projects = getProjectsFromStorage(queryFY, mode);
    
    try {
      const configStr = typeof window !== 'undefined' ? window.localStorage.getItem('creat_yojana_sync_config') : null;
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config && config.url && config.key) {
          console.log(`exportProjectRegistry: fetching fallback data for ${queryFY} ${mode} from server...`);
          const cloudData = await syncService.loadFromServer(config, queryFY, mode);
          if (cloudData && Array.isArray(cloudData.projects) && cloudData.projects.length > 0) {
            projects = cloudData.projects;
          }
        }
      }
    } catch (e) {
      console.warn("Could not load projects from server during export fallback:", e);
    }
    
    storageCache[cacheKey] = projects;
    return projects;
  };

  if (isPMOContext && filters) {
    // 1. Get all projects from Budget, Forecast, and Actuals for the selected FY
    const budgetProjects = await getProjectsWithCache(fy, "PMO_Budget");
    const fallbackBudgetProjects = await getProjectsWithCache(fy, "Budget");
    const finalBudgetProjects = budgetProjects.length > 0 ? budgetProjects : fallbackBudgetProjects;
    
    const forecastProjects = await getProjectsWithCache(fy, "Forecast");
    const actualsProjects = await getProjectsWithCache(fy, "Actuals");

    // 2. Load Master Projects for fy from localStorage
    const masterProjsStr = typeof window !== 'undefined' ? window.localStorage.getItem('masterProjects') : null;
    let masterProjectsList: any[] = [];
    if (masterProjsStr) {
      try {
        masterProjectsList = JSON.parse(masterProjsStr) || [];
      } catch (e) {}
    }
    // Filter master projects applicable to the selected FY
    const applicableMaster = masterProjectsList.filter(mp => 
      fy === 'All FY' || (mp.applicableFYs || []).includes(fy)
    );

    // 3. Create a union of all projects keyed by their code (case-insensitive)
    const mergedProjectsMap: Record<string, ProjectData> = {};

    applicableMaster.forEach(mp => {
      const code = (mp.code || '').trim().toUpperCase();
      if (code) {
        mergedProjectsMap[code] = {
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
        } as any;
      }
    });

    finalBudgetProjects.forEach(p => {
      if (!p.code) return;
      const code = p.code.trim().toUpperCase();
      if (!mergedProjectsMap[code]) {
        mergedProjectsMap[code] = { ...p };
      } else {
        const existing = mergedProjectsMap[code];
        existing.pmoRows = p.pmoRows || {};
        existing.rows = p.rows || {};
        existing.skills = p.skills || {};
        existing.expenses = p.expenses || {};
        existing.employeeSkills = p.employeeSkills || {};
        if (p.portfolioBudgetCr) existing.portfolioBudgetCr = p.portfolioBudgetCr;
        if (p.timelineOffset) existing.timelineOffset = p.timelineOffset;
      }
    });

    forecastProjects.forEach(p => {
      if (!p.code) return;
      const code = p.code.trim().toUpperCase();
      if (!mergedProjectsMap[code]) {
        mergedProjectsMap[code] = { ...p };
      } else {
        const existing = mergedProjectsMap[code];
        existing.forecast = p.forecast || {};
        existing.forecastEmployeeSkills = p.forecastEmployeeSkills || {};
      }
    });

    actualsProjects.forEach(p => {
      if (!p.code) return;
      const code = p.code.trim().toUpperCase();
      if (!mergedProjectsMap[code]) {
        mergedProjectsMap[code] = { ...p };
      } else {
        const existing = mergedProjectsMap[code];
        existing.actuals = p.actuals || {};
        existing.actualsEmployeeSkills = p.actualsEmployeeSkills || {};
      }
    });

    let allRegistryProjects = Object.values(mergedProjectsMap);

    // Apply UI filters to the union
    allRegistryProjects = allRegistryProjects.filter((p: any) => {
      const searchStr = (filters.search || '').toLowerCase().trim();
      if (searchStr && !(p.code || '').toLowerCase().includes(searchStr) && !(p.name || '').toLowerCase().includes(searchStr)) return false;
      if (filters.projectId && !filters.projectId.includes('All') && !filters.projectId.includes(p.code)) return false;
      if (filters.vertical && !filters.vertical.includes('All') && !filters.vertical.includes(p.vertical)) return false;
      if (filters.domain && !filters.domain.includes('All') && !filters.domain.includes(p.buDomain)) return false;
      if (filters.bu && !filters.bu.includes('All') && !filters.bu.includes(p.businessUnit)) return false;
      if (filters.projectType && !filters.projectType.includes('All') && !filters.projectType.includes(p.projectType)) return false;
      if (filters.family && !filters.family.includes('All') && !filters.family.includes(p.productFamily)) return false;
      if (filters.category && !filters.category.includes('All') && !filters.category.includes(p.category)) return false;
      if (filters.tbc && !filters.tbc.includes('All') && !filters.tbc.includes(p.tbc)) return false;
      if (filters.pdh && !filters.pdh.includes('All') && !filters.pdh.includes(p.pdh)) return false;
      if (filters.generation && !filters.generation.includes('All') && !filters.generation.includes(p.generation || 'Current')) return false;
      return true;
    });

    projectsInScope = allRegistryProjects;
  }

  // Enrich the projects in scope with budget, forecast, and actuals data from their respective storage buckets
  const enrichedProjects = await Promise.all(projectsInScope.map(async (p) => {
    let projFY = p.fiscalYear || fy;
    if (projFY === "All FY" || !projFY) {
      projFY = "FY 25-26";
    }

    let budgetProjects = await getProjectsWithCache(projFY, isPMOContext ? "PMO_Budget" : "Budget");
    if (isPMOContext && (!budgetProjects || budgetProjects.length === 0)) {
      budgetProjects = await getProjectsWithCache(projFY, "Budget");
    }
    const forecastProjects = await getProjectsWithCache(projFY, "Forecast");
    const actualsProjects = await getProjectsWithCache(projFY, "Actuals");

    const codeUpper = (p.code || "").toUpperCase().trim();
    const idStr = String(p.id);

    const budgetProj = budgetProjects.find((bp) => {
      const bpId = bp.id ? String(bp.id) : '';
      const bpCode = (bp.code || '').toUpperCase().trim();
      return (bpId && bpId === idStr) || (bpCode && bpCode === codeUpper);
    });
    const forecastProj = forecastProjects.find((fp) => {
      const fpId = fp.id ? String(fp.id) : '';
      const fpCode = (fp.code || '').toUpperCase().trim();
      return (fpId && fpId === idStr) || (fpCode && fpCode === codeUpper);
    });
    const actualsProj = actualsProjects.find((ap) => {
      const apId = ap.id ? String(ap.id) : '';
      const apCode = (ap.code || '').toUpperCase().trim();
      return (apId && apId === idStr) || (apCode && apCode === codeUpper);
    });

    const enriched = {
      ...p,
    } as ProjectData;

    // Recalculate properties if they exist in budgetProj
    if (budgetProj) {
      if (budgetProj.timelineOffset !== undefined && budgetProj.timelineOffset !== 0) {
        enriched.timelineOffset = budgetProj.timelineOffset;
      }
      if (budgetProj.budgetMode) {
        enriched.budgetMode = budgetProj.budgetMode;
      }
      if (budgetProj.portfolioBudgetCr) {
        enriched.portfolioBudgetCr = budgetProj.portfolioBudgetCr;
      }
    }

    const mergePropValue = (propKey: keyof ProjectData, budgetVal: any, activeVal: any) => {
      const bObj = (budgetVal && typeof budgetVal === 'object') ? budgetVal : {};
      const aObj = (activeVal && typeof activeVal === 'object') ? activeVal : {};
      
      const merged = { ...bObj };
      Object.entries(aObj).forEach(([cat, months]: [string, any]) => {
        const hasActiveData = Array.isArray(months) 
          ? months.some(v => v !== 0) 
          : (months && typeof months === 'object' ? Object.values(months).some(v => Number(v) !== 0) : false);

        if (hasActiveData) {
          merged[cat] = months;
        } else if (!merged[cat]) {
          merged[cat] = months;
        }
      });
      (enriched as any)[propKey] = merged;
    };

    const mergeNestedAllocs = (budgetNest: any, activeNest: any) => {
      const bNest = (budgetNest && typeof budgetNest === 'object') ? budgetNest : {};
      const aNest = (activeNest && typeof activeNest === 'object') ? activeNest : {};
      const merged = { ...bNest };
      
      Object.entries(aNest).forEach(([skill, allocsByEmail]: [string, any]) => {
        if (!merged[skill]) {
          merged[skill] = allocsByEmail;
        } else {
          merged[skill] = { ...merged[skill] };
          Object.entries(allocsByEmail || {}).forEach(([email, monthlyArr]: [string, any]) => {
            const hasActiveData = Array.isArray(monthlyArr) 
              ? monthlyArr.some(v => v !== 0) 
              : (monthlyArr && typeof monthlyArr === 'object' ? Object.values(monthlyArr).some(v => Number(v) !== 0) : false);

            if (hasActiveData) {
              merged[skill][email] = monthlyArr;
            }
          });
        }
      });
      return merged;
    };

    // Budget data enrichment
    mergePropValue('pmoRows', budgetProj?.pmoRows, p.pmoRows);
    mergePropValue('rows', budgetProj?.rows, p.rows);
    mergePropValue('skills', budgetProj?.skills, p.skills);
    mergePropValue('expenses', budgetProj?.expenses, p.expenses);
    enriched.employeeSkills = mergeNestedAllocs(budgetProj?.employeeSkills, p.employeeSkills);

    // Forecast data enrichment
    mergePropValue('forecast', forecastProj?.forecast, p.forecast);
    enriched.forecastEmployeeSkills = mergeNestedAllocs(forecastProj?.forecastEmployeeSkills, p.forecastEmployeeSkills);

    // Actuals data enrichment
    mergePropValue('actuals', actualsProj?.actuals, p.actuals);
    enriched.actualsEmployeeSkills = mergeNestedAllocs(actualsProj?.actualsEmployeeSkills, p.actualsEmployeeSkills);

    return enriched;
  }));

  projectsInScope = enrichedProjects;

  const workbook = new ExcelJS.Workbook();
  const isSingleProject = isExplicitSingleProjectExport;
  const financials = masterConfig.fyFinancials?.[fy] || {
    hourlyRate: masterConfig.hourlyRate || RATE_PER_HOUR,
    hoursPerMonth: masterConfig.hoursPerMonth || HOURS_PER_MONTH,
  };
  const hourlyRate = financials.hourlyRate;
  const hoursPerMonth = financials.hoursPerMonth;

  const sourceKey =
    fiscalMode === "Actuals" || fiscalMode === "Variance"
      ? "actuals"
      : fiscalMode === "Forecast"
        ? "forecast"
        : fiscalMode === "PMO_Budget"
          ? "pmoRows"
          : "rows";
  const fiscalYearsList = ALL_FISCAL_YEARS.filter(y => y !== 'All FY');
  const activeFyForRate = selectedFY || fy;
  const curFyIdx = fiscalYearsList.indexOf(activeFyForRate);
  const prevFy = curFyIdx > 0 ? fiscalYearsList[curFyIdx - 1] : fiscalYearsList[0];
  const prevFyFinancials = masterConfig.fyFinancials?.[prevFy];
  const lyRate = prevFyFinancials?.hourlyRate !== undefined && prevFyFinancials?.hourlyRate !== null
    ? prevFyFinancials.hourlyRate
    : (masterConfig.hourlyRate || RATE_PER_HOUR);
  const availableVerticals = Array.from(
    new Set(projectsInScope.map((p) => p.vertical).filter(Boolean)),
  );

  // 1. Master Sheet Setup
  const masterSheet = workbook.addWorksheet("Project List");
  const masterCols = [
    "System-ID",
    "ID",
    "TBC",
    "Vertical",
    "Category",
    "Family",
    "Generation",
    "Project Name",
    "Domain",
    "BU",
    "PDH",
    "Type",
    "Customer",
    "PACE",
    "Segment",
    "SOP",
    "Budget (Cr)",
    "Allocated Budget (Cr)",
    "Forecast (Cr)",
    "Actuals (Cr)",
    "IG Gate",
    "Latest Remark",
  ];

  masterSheet.columns = masterCols.map((c) => ({ width: 18 }));
  masterSheet.getColumn(1).hidden = true; // HIDE System-ID
  masterSheet.views = [{ state: "frozen", xSplit: 8, ySplit: 2 }];

  const projectCount = projectsInScope.length;
  const dataStartRowIdx = 3;
  const dataEndRowIdx = 2 + projectCount;

  const subtotalRowData = Array(masterCols.length).fill(null);
  subtotalRowData[1] = "SUBTOTAL (ALL LISTED)";
  [17, 18, 19, 20].forEach((colIndex) => {
    const colLetter = getColLetter(colIndex);
    subtotalRowData[colIndex - 1] = {
      formula: `SUM(${colLetter}${dataStartRowIdx}:${colLetter}${dataEndRowIdx})`,
    };
  });

  const masterSubtotalRow = masterSheet.addRow(subtotalRowData);
  masterSubtotalRow.font = { bold: true, color: { argb: "FF000000" } };
  masterSubtotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEDF2F7" },
  };
  masterSubtotalRow.alignment = { vertical: "middle" };
  masterSubtotalRow.height = 25;
  [17, 18, 19, 20].forEach(
    (col) => (masterSubtotalRow.getCell(col).numFmt = RUPEE_FMT),
  );

  const mH = masterSheet.addRow(masterCols);
  applyStandardHeader(mH);

  const parseAllocsLine = (allocs: any): number[] => {
    const arr = new Array(MAX_MONTHS).fill(0);
    if (Array.isArray(allocs)) {
      allocs.forEach((val, i) => { if (i < MAX_MONTHS) arr[i] = val || 0; });
    } else if (allocs && typeof allocs === 'object') {
      Object.entries(allocs).forEach(([k, v]) => {
        const idx = parseInt(k);
        if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) {
          arr[idx] = Number(v) || 0;
        }
      });
    }
    return arr;
  };

  const buildResourceAllocationSheet = () => {
    const sheet = workbook.addWorksheet('Resource Allocation');
    const raHeader = ['System-ID', 'ID', 'Project Code', 'Vertical', 'Project Name', 'Skill', 'Resource Name', 'Email', ...currentMonths, 'Total Allocations'];
    const hR = sheet.addRow(raHeader);
    applyStandardHeader(hR);

    const vLookup = (colIndex: number) => ({
      formula: `VLOOKUP($A${sheet.rowCount + 1}, 'Project List'!$A:$W, ${colIndex}, FALSE)`,
    });
    
    const empSkillsKey = fiscalMode === "Actuals" || fiscalMode === "Variance" ? "actualsEmployeeSkills" : (fiscalMode === "Forecast" ? "forecastEmployeeSkills" : "employeeSkills");

    projectsInScope.forEach(p => {
       const off = p.timelineOffset || 0;
       const skillsObj = p[empSkillsKey] as Record<string, Record<string, number[]>>;
       Object.entries(skillsObj || {}).forEach(([skill, allocated]) => {
         Object.entries(allocated || {}).forEach(([email, monthlyAllocs]) => {
           const empInfo = p.employeeInfo?.[email] || { name: 'Unknown', email };
           const arr = parseAllocsLine(monthlyAllocs);
           const visible = currentMonths.map(m => {
             const absIdx = getAbsoluteMonthIndex(m);
             return (absIdx >= 0 && absIdx < MAX_MONTHS) ? arr[absIdx] : 0;
           });
           
           if (visible.some(v => v > 0)) {
             const rowData: any[] = [
               p.id, 
               vLookup(2), 
               vLookup(2), 
               vLookup(4), 
               vLookup(8), 
               skill,
               empInfo.name, 
               email,
               ...visible
             ];
             const startCol = 'I'; // Data starts at Column I now (index 9)
             const endCol = getColLetter(8 + currentMonths.length); 
             rowData.push({ formula: `SUM(${startCol}${sheet.rowCount + 1}:${endCol}${sheet.rowCount + 1})` });
             
             const row = sheet.addRow(rowData);
             for (let i = 9; i <= 9 + currentMonths.length; i++) {
               row.getCell(i).numFmt = '0.00';
             }
           }
         });
       });
    });
    sheet.views = [{ state: 'frozen', xSplit: 8, ySplit: 1 }];
    sheet.getColumn(1).hidden = true;
    sheet.getColumn(2).hidden = true;
    sheet.columns.forEach((c, i) => { 
      if (i > 0 && i < 8) c.width = 18; 
      else if (i >= 8) c.width = 12; 
    });
  };

  const projectSheetRowMap: Record<string, { sheet: string; row: number }> = {};

  const buildDataSheet = (
    sheetName: string,
    filteredProjects: ProjectData[],
    dataKey: string,
    addToRowMap: boolean,
  ) => {
    const sheet = workbook.addWorksheet(sheetName);
    const detailHeader = [
      "System-ID",
      "ID",
      "TBC",
      "Vertical",
      "Category",
      "Family",
      "Project Name",
      "Functional Unit / Label",
      ...currentMonths,
      "Agg. Total",
      "Average",
      "Row Remarks",
    ];
    const dH = sheet.addRow(detailHeader);
    applyStandardHeader(dH);

    filteredProjects.forEach((p) => {
      const off = p.timelineOffset || 0;
      let projFY = p.fiscalYear || fy;
      if (projFY === "All FY" || !projFY) {
        projFY = "FY 25-26";
      }
      const projFinancials = masterConfig.fyFinancials?.[projFY] || {
        hourlyRate: masterConfig.hourlyRate || RATE_PER_HOUR,
        hoursPerMonth: masterConfig.hoursPerMonth || HOURS_PER_MONTH,
        contractedEmployeeRate: masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE,
      };
      const projHourlyRate = projFinancials.hourlyRate;
      const projHoursPerMonth = projFinancials.hoursPerMonth;
      const projContractedRate = projFinancials.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE;

      const vLookup = (colIndex: number) => ({
        formula: `VLOOKUP($A${sheet.rowCount + 1}, 'Project List'!$A:$W, ${colIndex}, FALSE)`,
      });

      const createRow = (
        label: string,
        vals: (number | { formula: string })[],
        isAgg = false,
        isMM = false,
      ) => {
        const rowData: any[] = [
          p.id,
          vLookup(2),
          vLookup(3),
          vLookup(4),
          vLookup(5),
          vLookup(6),
          vLookup(8),
          label,
          ...vals,
        ];
        const row = sheet.addRow(rowData);
        const mCount = currentMonths.length;
        const aggColIndex = 9 + mCount;
        const aggColLetter = getColLetter(aggColIndex);
        const avgColLetter = getColLetter(aggColIndex + 1);
        const startCol = "I";
        const endCol = getColLetter(8 + mCount);

        row.getCell(aggColIndex).value = {
          formula: `SUM(${startCol}${row.number}:${endCol}${row.number})`,
        };
        row.getCell(aggColIndex + 1).value = {
          formula: `${aggColLetter}${row.number}/12`,
        };

        if (isAgg) {
          row.font = { bold: true };
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isMM ? "FFF1F5F9" : "FFE0E7FF" },
          };
        }

        if (isMM) {
          for (let i = 9; i <= aggColIndex + 1; i++)
            row.getCell(i).numFmt = "0.00";
        } else {
          for (let i = 9; i <= aggColIndex + 1; i++)
            row.getCell(i).numFmt = RUPEE_FMT;
        }
        return row;
      };

      const directManpowerCategories = MANPOWER_CATEGORIES.filter(cat => cat !== 'Contracted Employee');
      const directManpowerRowNumbers: number[] = [];

      directManpowerCategories.forEach((cat) => {
        let fullRow: number[] | undefined;
        const primaryData = (p as any)[dataKey]?.[cat];
        const parsedPrimary = parseAllocsLine(primaryData);
        if (parsedPrimary.some((v) => v !== 0)) {
          fullRow = parsedPrimary;
        } else if (dataKey === 'pmoRows') {
          fullRow = parseAllocsLine((p.pmoRows as any)?.[cat]);
        } else if (dataKey === 'rows') {
          fullRow = parseAllocsLine((p.rows as any)?.[cat] || (p.skills as any)?.[cat] || (p.expenses as any)?.[cat]);
        } else if (dataKey === 'forecast') {
          if (p.forecastEmployeeSkills && p.forecastEmployeeSkills[cat]) {
            const sumRow = Array(MAX_MONTHS).fill(0);
            Object.values(p.forecastEmployeeSkills[cat]).forEach((allocs: any) => {
              const parsed = parseAllocsLine(allocs);
              parsed.forEach((val, i) => { sumRow[i] += val; });
            });
            if (sumRow.some(v => v !== 0)) fullRow = sumRow;
          }
        } else if (dataKey === 'actuals') {
          if (p.actualsEmployeeSkills && p.actualsEmployeeSkills[cat]) {
            const sumRow = Array(MAX_MONTHS).fill(0);
            Object.values(p.actualsEmployeeSkills[cat]).forEach((allocs: any) => {
              const parsed = parseAllocsLine(allocs);
              parsed.forEach((val, i) => { sumRow[i] += val; });
            });
            if (sumRow.some(v => v !== 0)) fullRow = sumRow;
          }
        } else {
          fullRow = Array(MAX_MONTHS).fill(0);
        }
        
        fullRow = fullRow || Array(MAX_MONTHS).fill(0);
        const visible = currentMonths.map((m) => {
          const absIdx = getAbsoluteMonthIndex(m);
          const i = absIdx - off;
          return i >= 0 && i < MAX_MONTHS ? fullRow[i] : 0;
        });
        const r = createRow(cat, visible, false, true);
        directManpowerRowNumbers.push(r.number);
      });

      const totalDirectMMFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        const sumTerms = directManpowerRowNumbers.map(rNum => `${col}${rNum}`).join(',');
        return { formula: sumTerms ? `=SUM(${sumTerms})` : `=${col}${directManpowerRowNumbers[0] || 0}` };
      });
      const totalDirectMMRow = createRow("Total Manpower (MM)", totalDirectMMFormulas, true, true);

      // Contracted Employee MM row
      let contractedFullRow: number[] | undefined;
      const primaryCe = (p as any)[dataKey]?.["Contracted Employee"];
      const parsedCe = parseAllocsLine(primaryCe);
      if (parsedCe.some((v) => v !== 0)) {
        contractedFullRow = parsedCe;
      } else if (dataKey === 'pmoRows') {
        contractedFullRow = parseAllocsLine((p.pmoRows as any)?.["Contracted Employee"]);
      } else if (dataKey === 'rows') {
        contractedFullRow = parseAllocsLine((p.rows as any)?.["Contracted Employee"] || (p.skills as any)?.["Contracted Employee"]);
      } else if (dataKey === 'forecast') {
        if (p.forecastEmployeeSkills && p.forecastEmployeeSkills["Contracted Employee"]) {
          const sumRow = Array(MAX_MONTHS).fill(0);
          Object.values(p.forecastEmployeeSkills["Contracted Employee"]).forEach((allocs: any) => {
            const parsed = parseAllocsLine(allocs);
            parsed.forEach((val, i) => { sumRow[i] += val; });
          });
          if (sumRow.some(v => v !== 0)) contractedFullRow = sumRow;
        }
      } else if (dataKey === 'actuals') {
        if (p.actualsEmployeeSkills && p.actualsEmployeeSkills["Contracted Employee"]) {
          const sumRow = Array(MAX_MONTHS).fill(0);
          Object.values(p.actualsEmployeeSkills["Contracted Employee"]).forEach((allocs: any) => {
            const parsed = parseAllocsLine(allocs);
            parsed.forEach((val, i) => { sumRow[i] += val; });
          });
          if (sumRow.some(v => v !== 0)) contractedFullRow = sumRow;
        }
      }
      contractedFullRow = contractedFullRow || Array(MAX_MONTHS).fill(0);
      const contractedVisible = currentMonths.map((m) => {
        const absIdx = getAbsoluteMonthIndex(m);
        const i = absIdx - off;
        return i >= 0 && i < MAX_MONTHS ? contractedFullRow[i] : 0;
      });
      const contractedRow = createRow("Contracted Employee", contractedVisible, false, true);
      const contractedMMRowNumber = contractedRow.number;

      const totalEffortFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        return { formula: `=${col}${totalDirectMMRow.number} + ${col}${contractedMMRowNumber}` };
      });
      const totalEffortRow = createRow("Total Effort (MM)", totalEffortFormulas, true, true);
      for (let i = 9; i <= 8 + currentMonths.length; i++) {
        totalEffortRow.getCell(i).alignment = { horizontal: 'center' };
      }

      // Direct Employee Cost
      const directCrFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        return {
          formula: `=(${col}${totalDirectMMRow.number}) * _RegistryOptions!$O$2 * _RegistryOptions!$M$2 / 10^7`,
        };
      });
      const directCrRow = createRow("Direct Employee Cost", directCrFormulas, false, false);

      // Contracted Employee Expense
      const ceExpenseFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        return {
          formula: `=(${col}${contractedMMRowNumber} * _RegistryOptions!$O$2 * _RegistryOptions!$P$2) / 10^7`,
        };
      });
      const ceExpenseRow = createRow("Contracted Employee Expense", ceExpenseFormulas, false, false);
      ceExpenseRow.font = { color: { argb: 'FF000000' } };
      for (let i = 9; i <= 8 + currentMonths.length; i++) {
        ceExpenseRow.getCell(i).alignment = { horizontal: 'center' };
      }

      // Total People Cost (Cr)
      const totalPeopleCostFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        return {
          formula: `=${col}${directCrRow.number} + ${col}${ceExpenseRow.number}`,
        };
      });
      const totalPeopleCostRow = createRow("Total People Cost (Cr)", totalPeopleCostFormulas, true, false);
      const mmCrRow = totalPeopleCostRow;

      const mCount = currentMonths.length;
      const aggColIndex = 9 + mCount;
      mmCrRow.getCell(aggColIndex).value = {
        formula: `SUM(I${mmCrRow.number}:${getColLetter(8 + mCount)}${mmCrRow.number})`,
      };
      mmCrRow.getCell(aggColIndex + 1).value = {
        formula: `${getColLetter(aggColIndex)}${mmCrRow.number}/12`,
      };
      for (let i = 9; i <= aggColIndex + 1; i++)
        mmCrRow.getCell(i).numFmt = RUPEE_FMT;

      // Operational Expenses
      const expenseRowNumbers: number[] = [];
      const operationalExpenseCategories = EXPENSE_CATEGORIES.filter(
        cat => cat !== 'Contracted Employee Expense' && cat !== 'Contracted Employee' && cat !== 'Operational Expenses (Cr)'
      );

      operationalExpenseCategories.forEach((cat) => {
        let fullRow: number[] | undefined;
        const primaryData = (p as any)[dataKey]?.[cat];
        const parsedPrimary = parseAllocsLine(primaryData);
        if (parsedPrimary.some((v) => v !== 0)) {
          fullRow = parsedPrimary;
        } else if (dataKey === 'pmoRows') {
          fullRow = parseAllocsLine((p.pmoRows as any)?.[cat]);
        } else if (dataKey === 'rows') {
          fullRow = parseAllocsLine((p.rows as any)?.[cat] || (p.skills as any)?.[cat] || (p.expenses as any)?.[cat] || (cat === 'Consultant' ? (p.rows as any)?.['Consultancy'] || (p.expenses as any)?.['Consultancy'] : undefined));
        } else if (dataKey === 'forecast') {
          if (p.forecastEmployeeSkills && p.forecastEmployeeSkills[cat]) {
            const sumRow = Array(MAX_MONTHS).fill(0);
            Object.values(p.forecastEmployeeSkills[cat]).forEach((allocs: any) => {
              const parsed = parseAllocsLine(allocs);
              parsed.forEach((val, i) => { sumRow[i] += val; });
            });
            if (sumRow.some(v => v !== 0)) fullRow = sumRow;
          }
        } else if (dataKey === 'actuals') {
          if (p.actualsEmployeeSkills && p.actualsEmployeeSkills[cat]) {
            const sumRow = Array(MAX_MONTHS).fill(0);
            Object.values(p.actualsEmployeeSkills[cat]).forEach((allocs: any) => {
              const parsed = parseAllocsLine(allocs);
              parsed.forEach((val, i) => { sumRow[i] += val; });
            });
            if (sumRow.some(v => v !== 0)) fullRow = sumRow;
          }
        } else {
          fullRow = Array(MAX_MONTHS).fill(0);
        }

        fullRow = fullRow || Array(MAX_MONTHS).fill(0);
        const visible = currentMonths.map((m) => {
          const absIdx = getAbsoluteMonthIndex(m);
          const i = absIdx - off;
          const val = i >= 0 && i < MAX_MONTHS ? fullRow[i] : 0;
          return Math.abs(val) > 100 ? val / 10000000 : val;
        });
        const r = createRow(cat, visible, false, false);
        expenseRowNumbers.push(r.number);
      });

      const totalExpFormulas = currentMonths.map((_, i) => {
        const col = getColLetter(9 + i);
        const sumTerms = expenseRowNumbers.map(rNum => `${col}${rNum}`).join(',');
        return { formula: sumTerms ? `=SUM(${sumTerms})` : `=${col}${expenseRowNumbers[0] || 0}` };
      });
      const totalExpRow = createRow("Total Expense (Crs) [B]", totalExpFormulas, true);

      const tbRowData: any[] = [
        p.id,
        vLookup(2),
        vLookup(3),
        vLookup(4),
        vLookup(5),
        vLookup(6),
        vLookup(7),
        "TOTAL BUDGET (Crs) [A+B]",
      ];
      currentMonths.forEach((_, i) => {
        const col = getColLetter(9 + i);
        tbRowData.push({
          formula: `=${col}${mmCrRow.number} + ${col}${totalExpRow.number}`,
        });
      });
      const gTotalRow = sheet.addRow(tbRowData);
      gTotalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      gTotalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      gTotalRow.getCell(aggColIndex).value = {
        formula: `SUM(I${gTotalRow.number}:${getColLetter(8 + mCount)}${gTotalRow.number})`,
      };
      gTotalRow.getCell(aggColIndex + 1).value = {
        formula: `${getColLetter(aggColIndex)}${gTotalRow.number}/12`,
      };
      for (let i = 9; i <= aggColIndex + 1; i++)
        gTotalRow.getCell(i).numFmt = RUPEE_FMT;

      if (addToRowMap)
        projectSheetRowMap[p.id] = { sheet: sheetName, row: gTotalRow.number };
    });

    sheet.views = [{ state: "frozen", xSplit: 8, ySplit: 1 }];
    sheet.getColumn(1).hidden = true;
    sheet.columns.forEach((c, i) => {
      if (i > 0 && i < 7) c.width = 15;
      else if (i === 7) c.width = 30;
      else if (i > 7) c.width = 12;
    });
  };

  const buildAnalyticsSheet = () => {
    const analyticsSheet = workbook.addWorksheet("analytics");

    const MANPOWER_SEQUENCE = [
      'Product Manager', 'PDTL', 'Systems', 'Product Planning', 'Tech Sales',
      'Costing Cell', 'NPC', 'Hardware_CoC', 'Hardware_Vertical', 'ECAD',
      'Component Engineer', 'Lab Engineer', 'Mechanical_CoC', 'Mechanical_Vertical',
      'Material Science', 'CAE', 'Optics', 'Software_CoC', 'Software CS & FuSA',
      'Software_Vertical', 'INITIA', 'Proto Engineer', 'Application Engg',
      'Validation_CoC', 'Validation_Vertical', 'Manufacturing Engineering', 'Quality', 'Unspecified Skill'
    ];

    const EXPENSE_SEQUENCE = [
      'Travel', 'Material', 'Labs', 'License', 'Consultant', 'HR', 'Admin', 'Others', 'Contracted Employee', 'Contracted Employee Expense'
    ];

    const getAuthoritativeRowLocal = (
      p: any,
      cat: string,
      mode: FiscalMode
    ): number[] => {
      const sourceKey = mode === 'Actuals' ? 'actuals' : (mode === 'Forecast' ? 'forecast' : 'pmoRows');
      
      const findInObj = (obj: any, key: string) => {
        if (!obj) return undefined;
        if (obj[key] !== undefined) return obj[key];
        const keys = Object.keys(obj);
        const matchedKey = keys.find(k => k.toLowerCase() === key.toLowerCase());
        return matchedKey ? obj[matchedKey] : undefined;
      };

      const normalizeRow = (data: any): number[] => {
        const arr = new Array(144).fill(0);
        if (!data) return arr;
        if (Array.isArray(data)) {
          data.forEach((v, i) => {
            if (i < 144) arr[i] = Number(v) || 0;
          });
        } else if (typeof data === 'object') {
          Object.entries(data).forEach(([k, v]) => {
            const idx = parseInt(k);
            if (!isNaN(idx) && idx >= 0 && idx < 144) {
              arr[idx] = Number(v) || 0;
            }
          });
        }
        return arr;
      };

      const hasNonZero = (arr: number[]) => arr.some(v => v !== 0);

      // Try direct primary row for the current mode
      let primaryRow = findInObj(p[sourceKey], cat);
      if (primaryRow) {
        const normalized = normalizeRow(primaryRow);
        if (hasNonZero(normalized)) return normalized;
      }

      // Check actualsSkills / forecastSkills
      if (sourceKey === 'actuals') {
        primaryRow = findInObj(p.actualsSkills, cat);
        if (primaryRow) {
          const normalized = normalizeRow(primaryRow);
          if (hasNonZero(normalized)) return normalized;
        }
      } else if (sourceKey === 'forecast') {
        primaryRow = findInObj(p.forecastSkills, cat);
        if (primaryRow) {
          const normalized = normalizeRow(primaryRow);
          if (hasNonZero(normalized)) return normalized;
        }
      }

      // Fallback to employeeSkills based on mode
      const empSkillsKey = mode === 'Actuals' ? 'actualsEmployeeSkills' : (mode === 'Forecast' ? 'forecastEmployeeSkills' : (isPMOContext ? 'pmoEmployeeSkills' : 'employeeSkills'));
      const targetEmployeeSkills = ((p as any)[empSkillsKey] || (isPMOContext && mode === 'Budget' ? p.employeeSkills : undefined)) as any;
      if (targetEmployeeSkills) {
        const allocsObj = findInObj(targetEmployeeSkills, cat);
        if (allocsObj) {
          const sumRow = new Array(144).fill(0);
          Object.values(allocsObj).forEach((allocs: any) => {
            const normalizedAlloc = normalizeRow(allocs);
            for (let i = 0; i < 144; i++) {
              sumRow[i] += normalizedAlloc[i];
            }
          });
          if (hasNonZero(sumRow)) {
            return sumRow;
          }
        }
      }

      // Mode-isolated fallbacks: only check fallbacks relevant to the selected mode
      if (mode === 'Budget') {
        const fallbackSources = isPMOContext ? [p.pmoRows] : [p.rows, p.expenses, p.skills];
        for (const src of fallbackSources) {
          const row = findInObj(src, cat);
          if (row) {
            const normalized = normalizeRow(row);
            if (hasNonZero(normalized)) return normalized;
          }
        }
      } else if (mode === 'Actuals') {
        const fallbackSources = [p.actuals, p.actualsSkills];
        for (const src of fallbackSources) {
          const row = findInObj(src, cat);
          if (row) {
            const normalized = normalizeRow(row);
            if (hasNonZero(normalized)) return normalized;
          }
        }
      } else if (mode === 'Forecast') {
        const fallbackSources = [p.forecast, p.forecastSkills];
        for (const src of fallbackSources) {
          const row = findInObj(src, cat);
          if (row) {
            const normalized = normalizeRow(row);
            if (hasNonZero(normalized)) return normalized;
          }
        }
      }

      return new Array(144).fill(0);
    };

    const getActiveProjectData = (p: any, mode: FiscalMode) => {
      const activeSource: Record<string, number[]> = {};
      let dataToProcess: Record<string, any>;
      if (mode === 'Actuals') {
        dataToProcess = {
          ...(p.actuals || {}),
          ...(p.actualsSkills || {}),
          ...(p.actualsEmployeeSkills || {})
        };
      } else if (mode === 'Forecast') {
        dataToProcess = {
          ...(p.forecast || {}),
          ...(p.forecastSkills || {}),
          ...(p.forecastEmployeeSkills || {})
        };
      } else {
        dataToProcess = isPMOContext ? {
          ...(p.pmoRows || {}),
          ...(p.pmoSkills || {}),
          ...(p.pmoEmployeeSkills || p.employeeSkills || {})
        } : {
          ...(p.rows || {}),
          ...(p.skills || {}),
          ...(p.expenses || {}),
          ...(p.employeeSkills || {})
        };
      }
      
      const norm = (s: string) => (s || '').trim().toLowerCase();
      
      Object.keys(dataToProcess).forEach(cat => {
        const row = getAuthoritativeRowLocal(p, cat, mode);
        if (row.some(v => v !== 0)) {
          let finalCat = SKILL_MAPPING[cat] || cat;
          const normCat = norm(finalCat);
          const mappedMp = MANPOWER_CATEGORIES.find(c => norm(c as any) === normCat);
          if (mappedMp) {
            finalCat = mappedMp as string;
          } else {
            const mappedExp = EXPENSE_CATEGORIES.find(c => norm(c as any) === normCat);
            if (mappedExp) {
              finalCat = mappedExp as string;
            } else if (normCat === 'contracted employee') {
              finalCat = 'Contracted Employee';
            } else if (normCat === 'contracted employee expense') {
              finalCat = 'Contracted Employee Expense';
            }
          }

          if (!activeSource[finalCat]) {
            activeSource[finalCat] = new Array(144).fill(0);
          }
          for (let i = 0; i < 144; i++) {
            activeSource[finalCat][i] += (row[i] || 0);
          }
        }
      });
      return activeSource;
    };

    const monthsCount = currentMonths.length;
    const monthIndices = currentMonths.map(m => getAbsoluteMonthIndex(m));

    const ensureArray = (data: any) => {
      let fullArray: number[] = [];
      if (Array.isArray(data)) {
        fullArray = data;
      } else if (data && typeof data === 'object') {
        fullArray = new Array(MAX_MONTHS).fill(0);
        Object.entries(data).forEach(([k, v]) => {
          const idx = parseInt(k);
          if (!isNaN(idx) && idx >= 0 && idx < MAX_MONTHS) {
            fullArray[idx] = Number(v) || 0;
          }
        });
      } else {
        return new Array(monthsCount).fill(0);
      }
      return monthIndices.map(idx => Number(fullArray[idx]) || 0);
    };

    const getConsolidatedBudgetLocal = (targetMode: FiscalMode) => {
      const manpowerData: Record<string, number[]> = {};
      const expenseData: Record<string, number[]> = {};

      MANPOWER_SEQUENCE.forEach(k => manpowerData[k] = new Array(monthsCount).fill(0));
      EXPENSE_SEQUENCE.forEach(k => expenseData[k] = new Array(monthsCount).fill(0));

      const totalManpowerMM = new Array(monthsCount).fill(0);
      const totalDirectManpowerMM = new Array(monthsCount).fill(0);
      const totalHolidayMM = new Array(monthsCount).fill(0);
      const totalManpowerCr = new Array(monthsCount).fill(0);
      const totalDirectManpowerCr = new Array(monthsCount).fill(0);
      const totalExpenseCr = new Array(monthsCount).fill(0);
      const totalBudgetCr = new Array(monthsCount).fill(0);

      const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
      for (let i = 0; i < MAX_MONTHS; i++) {
        const fyStartYear = 19 + Math.floor(i / 12);
        const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
        
        const fyConfig = masterConfig.fyFinancials?.[fyStr];
        ratesCache[i] = {
          hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
          cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
        };
      }
      const hoursPerMonth = 180;

      const isHolidayLeave = (p: any) => (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');

      projectsInScope.forEach(p => {
        const activeSource = getActiveProjectData(p, targetMode);
        const budgetSource = activeSource;
        const expenseSource = activeSource;

        const holidayLeave = isHolidayLeave(p);
        
        const groupedBudgetSource: Record<string, number[]> = {};
        Object.entries(budgetSource || {}).forEach(([rawCat, monthsData]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          if (!groupedBudgetSource[cat]) groupedBudgetSource[cat] = new Array(monthsCount).fill(0);
          const monthsArray = ensureArray(monthsData);
          for (let i = 0; i < monthsCount; i++) {
            let val = (i < monthsArray.length) ? monthsArray[i] : (monthsData && typeof monthsData === 'object' ? (monthsData as any)[i] || (monthsData as any)[String(i)] || 0 : 0);
            val = Number(val) || 0;
            groupedBudgetSource[cat][i] += val;
          }
        });

        Object.entries(groupedBudgetSource).forEach(([cat, monthsArray]) => {
          const isContracted = cat.toLowerCase().includes('contracted');
          const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || 
                             cat.includes('_CoC') || 
                             cat.includes('_Vertical') || 
                             cat === 'NPC';
          
          if (!isManpower && !isContracted) return;
          
          if (!manpowerData[cat]) manpowerData[cat] = new Array(monthsCount).fill(0);
          monthsArray.forEach((v: number, i: number) => {
            if (holidayLeave && !isContracted) {
              totalHolidayMM[i] += v;
            } else {
              manpowerData[cat][i] += v;
            }
            
            totalManpowerMM[i] += v;

            if (!isContracted) {
              totalDirectManpowerMM[i] += v;
            }

            if (!holidayLeave || isContracted) {
              const globalIdx = monthIndices[i];
              if (globalIdx !== undefined && globalIdx >= 0) {
                const { hRate, cRate } = ratesCache[globalIdx] || { hRate: RATE_PER_HOUR, cRate: CONTRACTED_EMPLOYEE_RATE };
                if (isContracted) {
                  const cost = (v * cRate * hoursPerMonth) / 10000000;
                  totalManpowerCr[i] += cost;
                  
                  if (!expenseData['Contracted Employee Expense']) expenseData['Contracted Employee Expense'] = new Array(monthsCount).fill(0);
                  expenseData['Contracted Employee Expense'][i] += cost;
                } else if (!holidayLeave) {
                  const cost = (v * hRate * hoursPerMonth) / 10000000;
                  totalDirectManpowerCr[i] += cost;
                  totalManpowerCr[i] += cost;
                }
              }
            }
          });
        });

        // Pass 2: Process Expenses
        const groupedExpenseSource: Record<string, number[]> = {};
        Object.entries(expenseSource || {}).forEach(([rawCat, monthsData]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          if (!groupedExpenseSource[cat]) groupedExpenseSource[cat] = new Array(monthsCount).fill(0);
          const monthsArray = ensureArray(monthsData);
          for (let i = 0; i < monthsCount; i++) {
            let val = (i < monthsArray.length) ? monthsArray[i] : (monthsData && typeof monthsData === 'object' ? (monthsData as any)[i] || (monthsData as any)[String(i)] || 0 : 0);
            val = Number(val) || 0;
            groupedExpenseSource[cat][i] += val;
          }
        });

        Object.entries(groupedExpenseSource).forEach(([cat, monthsArray]) => {
          const isContracted = cat === 'Contracted Employee';
          const isContractedExp = cat === 'Contracted Employee Expense';
          const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || isContracted;
          if (!EXPENSE_CATEGORIES.includes(cat as any) || isManpower) return;
          
          if (!expenseData[cat]) expenseData[cat] = new Array(monthsCount).fill(0);
          monthsArray.forEach((val: number, i: number) => {
            const valCr = Math.abs(val) > 1000 ? val / 10000000 : val;
            const vCr = (typeof valCr === 'number' && !isNaN(valCr)) ? valCr : 0;

            if (!holidayLeave || isContractedExp) {
              if (isContractedExp) {
                const mmArray = groupedBudgetSource['Contracted Employee'] || [];
                const mm = mmArray[i] || 0;
                if (mm === 0) {
                  expenseData[cat][i] += vCr;
                  totalManpowerCr[i] += vCr;
                }
              } else if (!holidayLeave) {
                expenseData[cat][i] += vCr;
                totalExpenseCr[i] += vCr;
              }
            }
          });
        });
      });

      for (let i = 0; i < monthsCount; i++) {
        totalBudgetCr[i] = totalManpowerCr[i] + totalExpenseCr[i];
      }

      const sortedManpowerKeys = Object.keys(manpowerData).sort((a, b) => {
        const indexA = (MANPOWER_CATEGORIES as readonly string[]).indexOf(a);
        const indexB = (MANPOWER_CATEGORIES as readonly string[]).indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const sumA = manpowerData[a].reduce((acc, v) => acc + v, 0);
        const sumB = manpowerData[b].reduce((acc, v) => acc + v, 0);
        return sumB - sumA;
      });

      const sortedExpenseKeys = Object.keys(expenseData).sort((a, b) => {
        const indexA = (EXPENSE_CATEGORIES as readonly string[]).indexOf(a);
        const indexB = (EXPENSE_CATEGORIES as readonly string[]).indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const sumA = expenseData[a].reduce((acc, v) => acc + v, 0);
        const sumB = expenseData[b].reduce((acc, v) => acc + v, 0);
        return sumB - sumA;
      });

      return {
        manpowerData,
        expenseData,
        sortedManpowerKeys,
        sortedExpenseKeys,
        totalManpowerMM,
        totalDirectManpowerMM,
        totalHolidayMM,
        totalManpowerCr,
        totalDirectManpowerCr,
        totalExpenseCr,
        totalBudgetCr
      };
    };

    const activeConsolidations: Record<string, any> = {};
    (['Budget', 'Actuals'] as FiscalMode[]).forEach((m) => {
      activeConsolidations[m] = getConsolidatedBudgetLocal(m);
    });

    const mpKeys = new Set<string>();
    const expKeys = new Set<string>();
    ['Budget', 'Actuals'].forEach(m => {
      const cons = activeConsolidations[m];
      if (cons) {
        cons.sortedManpowerKeys.forEach((k: string) => mpKeys.add(k));
        cons.sortedExpenseKeys.forEach((k: string) => expKeys.add(k));
      }
    });
    const sortedManpowerKeys = Array.from(mpKeys);
    const sortedExpenseKeys = Array.from(expKeys);

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, // Slate 300
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const darkBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF475569' } }, // Slate 600
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };

    const sectionBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    // Header 1: Month names with colSpan 2
    const h1Row = analyticsSheet.addRow([]);
    h1Row.height = 24;
    
    // Header 2: Budget / Actuals
    const h2Row = analyticsSheet.addRow([]);
    h2Row.height = 20;

    // Col A
    analyticsSheet.mergeCells(1, 1, 2, 1);
    analyticsSheet.getCell(1, 1).value = "Functional Unit / Label";
    
    // Style Column A Header
    const colAHeaderCell = analyticsSheet.getCell(1, 1);
    colAHeaderCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    colAHeaderCell.fill = NAVY_HEADER_FILL;
    colAHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    // Fill months
    currentMonths.forEach((m, mIdx) => {
      const baseCol = 2 + mIdx * 2;
      
      // Merge month name across Budget and Actuals columns
      analyticsSheet.mergeCells(1, baseCol, 1, baseCol + 1);
      analyticsSheet.getCell(1, baseCol).value = m;
      
      const mCell = analyticsSheet.getCell(1, baseCol);
      mCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      mCell.fill = NAVY_HEADER_FILL;
      mCell.alignment = { vertical: "middle", horizontal: "center" };

      // Budget Subheader
      analyticsSheet.getCell(2, baseCol).value = "Budget";
      const bSubCell = analyticsSheet.getCell(2, baseCol);
      bSubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
      bSubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      bSubCell.alignment = { vertical: "middle", horizontal: "right" };

      // Actuals Subheader
      analyticsSheet.getCell(2, baseCol + 1).value = "Actuals";
      const aSubCell = analyticsSheet.getCell(2, baseCol + 1);
      aSubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
      aSubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      aSubCell.alignment = { vertical: "middle", horizontal: "right" };
    });

    // Total Header
    const totalBaseCol = 2 + monthsCount * 2;
    analyticsSheet.mergeCells(1, totalBaseCol, 1, totalBaseCol + 1);
    analyticsSheet.getCell(1, totalBaseCol).value = "Total";
    const totalHeaderCell = analyticsSheet.getCell(1, totalBaseCol);
    totalHeaderCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    totalHeaderCell.fill = NAVY_HEADER_FILL;
    totalHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    analyticsSheet.getCell(2, totalBaseCol).value = "Budget";
    const totalBSubCell = analyticsSheet.getCell(2, totalBaseCol);
    totalBSubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
    totalBSubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    totalBSubCell.alignment = { vertical: "middle", horizontal: "right" };

    analyticsSheet.getCell(2, totalBaseCol + 1).value = "Actuals";
    const totalASubCell = analyticsSheet.getCell(2, totalBaseCol + 1);
    totalASubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
    totalASubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    totalASubCell.alignment = { vertical: "middle", horizontal: "right" };

    // Average Header
    const avgBaseCol = totalBaseCol + 2;
    analyticsSheet.mergeCells(1, avgBaseCol, 1, avgBaseCol + 1);
    analyticsSheet.getCell(1, avgBaseCol).value = "Average";
    const avgHeaderCell = analyticsSheet.getCell(1, avgBaseCol);
    avgHeaderCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    avgHeaderCell.fill = NAVY_HEADER_FILL;
    avgHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

    analyticsSheet.getCell(2, avgBaseCol).value = "Budget";
    const avgBSubCell = analyticsSheet.getCell(2, avgBaseCol);
    avgBSubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
    avgBSubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    avgBSubCell.alignment = { vertical: "middle", horizontal: "right" };

    analyticsSheet.getCell(2, avgBaseCol + 1).value = "Actuals";
    const avgASubCell = analyticsSheet.getCell(2, avgBaseCol + 1);
    avgASubCell.font = { bold: true, color: { argb: "FFCBD5E1" }, size: 8 };
    avgASubCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    avgASubCell.alignment = { vertical: "middle", horizontal: "right" };

    const totalCols = 5 + 2 * monthsCount;

    // Apply borders to row 1 and 2 (Header cells)
    for (let r = 1; r <= 2; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cell = analyticsSheet.getCell(r, c);
        cell.border = headerBorder;
      }
    }

    // Merged row styling helper
    const applyMergedRowStyles = (row: ExcelJS.Row, font: any, fill: any, border: any) => {
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        cell.font = font;
        cell.fill = fill;
        cell.border = border;
      }
    };

    // Helper row builder
    const renderMonthlyComparisonRow = (
      label: string,
      getBudgetData: () => number[],
      getActualsData: () => number[],
      isCurrency: boolean = false,
      isBold: boolean = false,
      bgColor?: string,
      textColor?: string
    ) => {
       const budgetVals = getBudgetData() || new Array(monthsCount).fill(0);
       const actualsVals = getActualsData() || new Array(monthsCount).fill(0);
       
       const rowData: any[] = [label];
       for (let i = 0; i < monthsCount; i++) {
         rowData.push(budgetVals[i] === 0 ? null : budgetVals[i]);
         rowData.push(actualsVals[i] === 0 ? null : actualsVals[i]);
       }
       
       // Total
       const budgetTotal = budgetVals.reduce((a, b) => a + b, 0);
       const actualsTotal = actualsVals.reduce((a, b) => a + b, 0);
       rowData.push(budgetTotal === 0 ? null : budgetTotal);
       rowData.push(actualsTotal === 0 ? null : actualsTotal);
       
       // Average
       const budgetAvg = budgetTotal / monthsCount;
       const actualsAvg = actualsTotal / monthsCount;
       rowData.push(budgetAvg === 0 ? null : budgetAvg);
       rowData.push(actualsAvg === 0 ? null : actualsAvg);
       
       const row = analyticsSheet.addRow(rowData);
       
       // Style the row
       row.height = 20;
       if (isBold) {
         row.font = { bold: true, size: 9 };
       } else {
         row.font = { size: 9 };
       }
       if (textColor) {
         row.font = { ...row.font, color: { argb: textColor } };
       }
       if (bgColor) {
         row.fill = {
           type: "pattern",
           pattern: "solid",
           fgColor: { argb: bgColor }
         };
       }
       
       // Number formatting and borders for all cells
       const numFmt = isCurrency ? RUPEE_FMT : "0.00";
       for (let c = 1; c <= totalCols; c++) {
         const cell = row.getCell(c);
         
         // Set border based on background color
         if (bgColor === "FF0F172A") {
           cell.border = darkBorder;
         } else {
           cell.border = thinBorder;
         }

         if (c > 1) {
           if (cell.value !== null) {
             cell.numFmt = numFmt;
           }
           cell.alignment = { horizontal: "right", vertical: "middle" };
           
           // Subtle background colors for Budget / Actuals columns to separate them visually
           if (!bgColor) {
             const isActualCol = c % 2 === 1;
             if (isActualCol) {
               cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FBF9" } }; // extremely light green
             } else {
               cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }; // extremely light blue/gray
             }
           }
         } else {
           cell.alignment = { horizontal: "left", vertical: "middle" };
         }
       }
       return row;
    };

    // 1. Direct Manpower Section Header
    const directHeaderRow = analyticsSheet.addRow(["DIRECT MANPOWER (MM)"]);
    directHeaderRow.height = 24;
    analyticsSheet.mergeCells(directHeaderRow.number, 1, directHeaderRow.number, totalCols);
    const sectionFont = { bold: true, size: 10, color: { argb: "FF1E293B" } };
    const sectionFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    applyMergedRowStyles(directHeaderRow, sectionFont, sectionFill, sectionBorder);
    directHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    // Roles
    sortedManpowerKeys.filter(k => k !== 'Contracted Employee').map(key => {
      renderMonthlyComparisonRow(
        key,
        () => activeConsolidations['Budget']?.manpowerData?.[key] || new Array(monthsCount).fill(0),
        () => activeConsolidations['Actuals']?.manpowerData?.[key] || new Array(monthsCount).fill(0),
        false
      );
    });

    // Holidays
    renderMonthlyComparisonRow(
      'Holidays & Leaves (MM)',
      () => activeConsolidations['Budget']?.totalHolidayMM || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalHolidayMM || new Array(monthsCount).fill(0),
      false,
      false,
      undefined,
      "FF64748B"
    );

    // Total Direct Manpower
    renderMonthlyComparisonRow(
      'Total Direct Manpower (MM)',
      () => activeConsolidations['Budget']?.totalDirectManpowerMM || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalDirectManpowerMM || new Array(monthsCount).fill(0),
      false,
      true,
      "FFE2E8F0"
    );

    // 2. Contracted Manpower Section Header
    const contractedHeaderRow = analyticsSheet.addRow(["CONTRACTED MANPOWER (MM)"]);
    contractedHeaderRow.height = 24;
    analyticsSheet.mergeCells(contractedHeaderRow.number, 1, contractedHeaderRow.number, totalCols);
    applyMergedRowStyles(contractedHeaderRow, sectionFont, sectionFill, sectionBorder);
    contractedHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    // Contracted Employee
    sortedManpowerKeys.filter(k => k === 'Contracted Employee').map(key => {
      renderMonthlyComparisonRow(
        key,
        () => activeConsolidations['Budget']?.manpowerData?.[key] || new Array(monthsCount).fill(0),
        () => activeConsolidations['Actuals']?.manpowerData?.[key] || new Array(monthsCount).fill(0),
        false
      );
    });

    // Total Effort (MM)
    renderMonthlyComparisonRow(
      'Total Effort (MM)',
      () => activeConsolidations['Budget']?.totalManpowerMM || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalManpowerMM || new Array(monthsCount).fill(0),
      false,
      true,
      "FFE2E8F0"
    );

    analyticsSheet.addRow([]); // Blank spacer

    // 3. People Cost Section Header
    const peopleCostHeaderRow = analyticsSheet.addRow(["PEOPLE COST"]);
    peopleCostHeaderRow.height = 24;
    analyticsSheet.mergeCells(peopleCostHeaderRow.number, 1, peopleCostHeaderRow.number, totalCols);
    applyMergedRowStyles(peopleCostHeaderRow, sectionFont, sectionFill, sectionBorder);
    peopleCostHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    // Sub-label for Direct Employee Cost
    const decRow = analyticsSheet.addRow(["Direct Employee Cost"]);
    decRow.height = 20;
    analyticsSheet.mergeCells(decRow.number, 1, decRow.number, totalCols);
    const decFont = { bold: true, italic: true, size: 9, color: { argb: "FF2563EB" } };
    const decFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    applyMergedRowStyles(decRow, decFont, decFill, thinBorder);
    decRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    // Direct Employee Cost Values
    renderMonthlyComparisonRow(
      'Direct Employee Cost (Crs)',
      () => activeConsolidations['Budget']?.totalDirectManpowerCr || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalDirectManpowerCr || new Array(monthsCount).fill(0),
      true,
      false,
      undefined,
      "FF2563EB"
    );

    // Contracted Employee Expense
    sortedExpenseKeys.filter(k => k === 'Contracted Employee Expense').map(key => {
      renderMonthlyComparisonRow(
        key,
        () => activeConsolidations['Budget']?.expenseData?.[key] || new Array(monthsCount).fill(0),
        () => activeConsolidations['Actuals']?.expenseData?.[key] || new Array(monthsCount).fill(0),
        true,
        false,
        undefined,
        "FF4F46E5"
      );
    });

    // 4. Operational Expenses Section Header
    const opexHeaderRow = analyticsSheet.addRow(["OPERATIONAL EXPENSES"]);
    opexHeaderRow.height = 24;
    analyticsSheet.mergeCells(opexHeaderRow.number, 1, opexHeaderRow.number, totalCols);
    applyMergedRowStyles(opexHeaderRow, sectionFont, sectionFill, sectionBorder);
    opexHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    // Expense Roles
    sortedExpenseKeys.filter(k => k !== 'Contracted Employee Expense' && k !== 'Contracted Employee').map(key => {
      renderMonthlyComparisonRow(
        key,
        () => activeConsolidations['Budget']?.expenseData?.[key] || new Array(monthsCount).fill(0),
        () => activeConsolidations['Actuals']?.expenseData?.[key] || new Array(monthsCount).fill(0),
        true
      );
    });

    // Total Expense
    renderMonthlyComparisonRow(
      'Total Expense (Crs)',
      () => activeConsolidations['Budget']?.totalExpenseCr || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalExpenseCr || new Array(monthsCount).fill(0),
      true,
      true,
      "FF0F172A",
      "FFFFFFFF"
    );

    // Total Budget
    renderMonthlyComparisonRow(
      'Total Budget (Crs)',
      () => activeConsolidations['Budget']?.totalBudgetCr || new Array(monthsCount).fill(0),
      () => activeConsolidations['Actuals']?.totalBudgetCr || new Array(monthsCount).fill(0),
      true,
      true,
      "FF0F172A",
      "FFFFFFFF"
    );

    // Column widths
    analyticsSheet.getColumn(1).width = 30;
    for (let c = 2; c <= totalCols; c++) {
      analyticsSheet.getColumn(c).width = 12;
    }

    // Freeze panes and turn on grid lines
    analyticsSheet.views = [{ showGridLines: true, state: "frozen", xSplit: 1, ySplit: 2 }];

    // -------------------------------------------------------------------------
    // GRAPH SHEET CREATION
    // -------------------------------------------------------------------------
    const graphSheet = workbook.addWorksheet("graph");

    // Enable grid lines for graphSheet
    graphSheet.views = [{ showGridLines: true }];

    try {
      // Generate and add Manpower Chart
      const manpowerImgBase64 = drawChartToCanvas("manpower", currentMonths, activeConsolidations, sortedManpowerKeys);
      if (manpowerImgBase64) {
        const imageId1 = workbook.addImage({
          base64: manpowerImgBase64,
          extension: "png"
        });
        graphSheet.addImage(imageId1, "B2:O25");
      }

      // Generate and add Expense Chart
      const expenseImgBase64 = drawChartToCanvas("expense", currentMonths, activeConsolidations, sortedExpenseKeys);
      if (expenseImgBase64) {
        const imageId2 = workbook.addImage({
          base64: expenseImgBase64,
          extension: "png"
        });
        graphSheet.addImage(imageId2, "B28:O51");
      }
    } catch (err) {
      console.error("Failed to generate or add charts to graph sheet:", err);
    }
  };

  const isActualsPMOProjectExport = isSingleProject && fiscalMode === 'Actuals';
  const isPMO_Budget = (fiscalMode as string) === 'PMO_Budget';

  if (isActualsPMOProjectExport) {
    buildDataSheet('Budget', projectsInScope, isPMOContext ? 'pmoRows' : 'rows', false);
    buildDataSheet('Actuals', projectsInScope, 'actuals', false);
    buildResourceAllocationSheet();
    if (isPMOContext) {
      buildAnalyticsSheet();
    }
  } else if (isPMO_Budget) {
    buildDataSheet('Budget', projectsInScope, 'pmoRows', false);
    buildDataSheet("Forecast", projectsInScope, "forecast", false);
    buildResourceAllocationSheet();
  } else {
    buildDataSheet('Budget', projectsInScope, isPMOContext ? 'pmoRows' : 'rows', false);
    buildDataSheet("Forecast", projectsInScope, "forecast", false);
    buildDataSheet("Actuals", projectsInScope, "actuals", false);
    buildResourceAllocationSheet();
    if (isPMOContext && fiscalMode === 'Actuals') {
      buildAnalyticsSheet();
    }
  }

  // 3. Fill Master Data Rows
  projectsInScope.forEach((p) => {
    const currentAggCol = getColLetter(9 + currentMonths.length);
    let budgetValue: any;
    let forecastValue: any;
    let actualsValue: any;

    if (isActualsPMOProjectExport) {
      budgetValue = p.portfolioBudgetCr || 0;
      forecastValue = 0;
      actualsValue = {
        formula: `=SUMIFS('Budget'!${currentAggCol}:${currentAggCol}, 'Budget'!$A:$A, $A${masterSheet.rowCount + 1}, 'Budget'!$H:$H, "TOTAL BUDGET (Crs) [A+B]")`,
      };
    } else if (isPMO_Budget) {
      budgetValue = {
        formula: `=SUMIFS('Budget'!${currentAggCol}:${currentAggCol}, 'Budget'!$A:$A, $A${masterSheet.rowCount + 1}, 'Budget'!$H:$H, "TOTAL BUDGET (Crs) [A+B]")`,
      };
      forecastValue = 0;
      actualsValue = p.actualSpentCr || 0;
    } else {
      budgetValue = {
        formula: `=SUMIFS('Budget'!${currentAggCol}:${currentAggCol}, 'Budget'!$A:$A, $A${masterSheet.rowCount + 1}, 'Budget'!$H:$H, "TOTAL BUDGET (Crs) [A+B]")`,
      };
      forecastValue = {
        formula: `=SUMIFS('Forecast'!${currentAggCol}:${currentAggCol}, 'Forecast'!$A:$A, $A${masterSheet.rowCount + 1}, 'Forecast'!$H:$H, "TOTAL BUDGET (Crs) [A+B]")`,
      };
      actualsValue = {
        formula: `=SUMIFS('Actuals'!${currentAggCol}:${currentAggCol}, 'Actuals'!$A:$A, $A${masterSheet.rowCount + 1}, 'Actuals'!$H:$H, "TOTAL BUDGET (Crs) [A+B]")`,
      };
    }

    const nextMasterRow = masterSheet.rowCount + 1;
    const allocatedBudgetValue = {
      formula: `=IF(C${nextMasterRow}="Yes",Q${nextMasterRow},0)`,
    };

    const row = masterSheet.addRow([
      p.id,
      p.code,
      p.tbc,
      p.vertical,
      p.category,
      p.productFamily,
      p.generation || "Current",
      p.name,
      p.buDomain,
      p.businessUnit,
      p.pdh || "",
      p.projectType,
      p.customer || "",
      p.pace,
      p.segment,
      ((p.sopMonth || "") + " " + (p.sopFyYear || "")).trim(),
      budgetValue,
      allocatedBudgetValue,
      forecastValue,
      actualsValue,
      p.currentGate || "TBD",
      p.remarks?.[p.remarks.length - 1]?.text || "",
    ]);
    [17, 18, 19, 20].forEach((col) => (row.getCell(col).numFmt = RUPEE_FMT));
  });

  // 4. Summary Sheet Setup
  if (!isSingleProject) {
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.addRow([
      "CREAT YOJANA | CONSOLIDATED R&D PORTFOLIO SUMMARY",
    ]).font = { bold: true, size: 14 };
    summarySheet.addRow([
      "FY 2026-27 | Consolidated View | Export Context: " +
        (selectedFY || "FY 25-26"),
    ]);
    summarySheet.addRow([]);

    const buildAllocationTable = (title: string, verticalsToSum: string[]) => {
      summarySheet.addRow([title]).font = { bold: true, size: 12 };
      const headerRow = summarySheet.addRow([
        "Vertical",
        "Confirmed Budget (Cr)",
        "% Share",
      ]);
      applyStandardHeader(headerRow);
      const startRow = summarySheet.rowCount + 1;

      verticalsToSum.forEach((v) => {
        let formula = `SUMIFS('Project List'!R:R, 'Project List'!D:D, "${v}")`;
        summarySheet.addRow([v, { formula }, ""]);
      });

      const endRow = summarySheet.rowCount;
      const grandTotalRow = summarySheet.addRow([
        "GRAND TOTAL",
        { formula: `SUM(B${startRow}:B${endRow})` },
        "",
      ]);
      grandTotalRow.font = { bold: true };
      grandTotalRow.getCell(1).font = { color: { argb: "FF4338CA" }, bold: true };
      grandTotalRow.getCell(2).font = { color: { argb: "FF4338CA" }, bold: true };
      const grandTotalRef = `B${grandTotalRow.number}`;

      for (let i = startRow; i <= grandTotalRow.number; i++) {
        const row = summarySheet.getRow(i);
        row.getCell(2).numFmt = RUPEE_FMT;
        row.getCell(3).value = {
          formula: `IF(${grandTotalRef}=0, 0, B${i}/${grandTotalRef})`,
        };
        row.getCell(3).numFmt = "0%";
      }
      summarySheet.addRow([]);
    };

    buildAllocationTable("GROSS BUDGET ALLOCATION", availableVerticals);

    const addDetailedSummaryTable = (
      title: string,
      pFilter: (p: ProjectData) => boolean,
      benchmarkKeys: string[],
    ) => {
      summarySheet.addRow([]);
      summarySheet.addRow([title]).font = {
        bold: true,
        size: 11,
        color: { argb: "FF4338CA" },
      };

      const headerCols = [
        "Category / Unit",
        ...currentMonths,
        "Agg. Total",
        "Average",
        "LY (Actual)",
        "Δ vs LY",
      ];
      const hRow = summarySheet.addRow(headerCols);
      applyStandardHeader(hRow);

      const sheetNames = (benchmarkKeys || [])
        .map((k) => k)
        .filter(Boolean) as string[];

      const getFormula = (label: string, colOffset: number) => {
        const colLetter = getColLetter(9 + colOffset); // Column I offset is 9
        const sheetName = fiscalMode === 'Forecast' ? 'Forecast' : (fiscalMode === 'Actuals' ? 'Actuals' : 'Budget');
        let sumifsArgs = `'${sheetName}'!${colLetter}:${colLetter}, '${sheetName}'!$H:$H, "${label}", '${sheetName}'!$C:$C, "Yes"`;
        if (title.startsWith("VERTICAL SUMMARY:")) {
            sumifsArgs += `, '${sheetName}'!$D:$D, "${benchmarkKeys[0]}"`;
        }
        return { formula: `=SUMIFS(${sumifsArgs})` };
      };

      const addRowWithFormulas = (
        label: string,
        isAgg = false,
        isMM = false,
        lyValueInput: number | string = 0,
      ) => {
        const rowData: any[] = [label];
        // Monthly formulas
        for (let m = 0; m < 12; m++) {
          rowData.push(getFormula(label, m));
        }
        // Agg. Total formula (Column U in detail sheets)
        rowData.push(getFormula(label, 12));
        // Average formula
        const rowNum = summarySheet.rowCount + 1;
        const aggCell = `N${rowNum}`;
        rowData.push({ formula: `=${aggCell}/12` });

        // LY Actual
        if (typeof lyValueInput === "string") {
          rowData.push({ formula: lyValueInput });
        } else {
          rowData.push(lyValueInput);
        }

        // Delta
        const avgCell = `O${rowNum}`;
        const aggCellForDelta = `N${rowNum}`;
        const lyCell = `P${rowNum}`;

        // Logic for Delta: financial rows use Agg. Total (N) - LY (P), MM rows use Average (O) - LY (P)
        if (
          label.includes("(Crs)") ||
          label.includes("TOTAL BUDGET") ||
          EXPENSE_CATEGORIES.includes(label)
        ) {
          rowData.push({ formula: `=${aggCellForDelta}-${lyCell}` });
        } else {
          rowData.push({ formula: `=${avgCell}-${lyCell}` });
        }

        const row = summarySheet.addRow(rowData);
        if (isAgg) {
          row.font = { bold: true };
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: label.includes("TOTAL BUDGET") ? "FF4F46E5" : "FFF1F5F9",
            },
          };
          if (label.includes("TOTAL BUDGET"))
            row.font.color = { argb: "FFFFFFFF" };
        }
        for (let i = 2; i <= headerCols.length; i++) {
          const cell = row.getCell(i);
          if (isMM || MANPOWER_CATEGORIES.some((c) => c === label))
            cell.numFmt = "0.00";
          else cell.numFmt = RUPEE_FMT;
        }
      };

      // 1. Individual Manpower Categories
      MANPOWER_CATEGORIES.forEach((cat) => {
        const label = cat;
        const ly = benchmarkKeys.reduce(
          (acc, k) => acc + (masterConfig.benchmarks?.[k]?.manpower?.[cat] || 0),
          0,
        );
        addRowWithFormulas(label, false, true, ly);
      });

      // 2. Total Manpower MM
      const lyTotalMM = benchmarkKeys.reduce(
        (acc, k) =>
          acc +
          Object.values(masterConfig.benchmarks?.[k]?.manpower || {}).reduce(
            (s, v) => s + v,
            0,
          ),
        0,
      );
      addRowWithFormulas("Total Manpower (MM)", true, true, lyTotalMM);
      const mmTotalRowIdx = summarySheet.rowCount;

      // 3. Total Manpower CR - Using formula for LY Actual
      const lyTotalMMCrFormula = `=P${mmTotalRowIdx} * _RegistryOptions!$N$2 * _RegistryOptions!$M$2 / 10^7`;
      addRowWithFormulas(
        "Total Manpower (Crs) [A]",
        true,
        false,
        lyTotalMMCrFormula,
      );

      // 4. Individual Expense Categories
      EXPENSE_CATEGORIES.forEach((cat) => {
        const ly = benchmarkKeys.reduce(
          (acc, k) => acc + (masterConfig.benchmarks?.[k]?.expenses?.[cat] || 0),
          0,
        );
        addRowWithFormulas(cat, false, cat === "Contracted Employee", ly);
      });

      // 5. Total Expense CR
      const lyTotalExp = benchmarkKeys.reduce((acc, k) => {
        const expenses = masterConfig.benchmarks?.[k]?.expenses || {};
        return (
          acc +
          Object.entries(expenses).reduce(
            (s, [cat, v]) => (cat !== "Contracted Employee" ? s + v : s),
            0,
          )
        );
      }, 0);
      addRowWithFormulas("Total Expense (Crs) [B]", true, false, lyTotalExp);

      // 6. Grand Total
      const lyGrandTotalFormula = `=P${mmTotalRowIdx + 1} + P${summarySheet.rowCount}`;
      addRowWithFormulas(
        "TOTAL BUDGET (Crs) [A+B]",
        true,
        false,
        lyGrandTotalFormula,
      );
    };

    availableVerticals.forEach((v) => {
      addDetailedSummaryTable(`VERTICAL SUMMARY: ${v}`, (p) => p.vertical === v, [
        v,
      ]);
    });
    addDetailedSummaryTable(
      `GLOBAL CONSOLIDATED R&D BUDGET SUMMARY`,
      (p) => true,
      availableVerticals,
    );

    summarySheet.columns.forEach((c, i) => {
      if (i === 0) c.width = 45;
      else c.width = 18;
    });
  }

  // 7. Setup Options Sheet (Last tab and hidden)
  const optionsSheet = workbook.addWorksheet("_RegistryOptions");
  optionsSheet.state = "hidden";
  const optionSets = [
    { name: "TBC", items: ["Yes", "No", "TBD"], col: 1 },
    { name: "Verticals", items: masterConfig.verticals || [], col: 2 },
    { name: "Categories", items: masterConfig.projectCategories || [], col: 3 },
    { name: "Families", items: masterConfig.productFamilies || [], col: 4 },
    { name: "Domains", items: masterConfig.buDomains || [], col: 5 },
    { name: "BUs", items: masterConfig.businessUnits || [], col: 6 },
    { name: "IGGates", items: IG_GATE_OPTIONS, col: 7 },
    { name: "ProjectTypes", items: masterConfig.projectTypes || [], col: 8 },
    { name: "PACE", items: masterConfig.paces || [], col: 9 },
    { name: "Segments", items: masterConfig.segments || [], col: 10 },
    { name: "Customers", items: masterConfig.customers || [], col: 11 },
  ];
  optionSets.forEach((set) => {
    optionsSheet.getCell(1, set.col).value = set.name;
    set.items.forEach(
      (it, i) => (optionsSheet.getCell(i + 2, set.col).value = it),
    );
  });
  const cfgFinancials = masterConfig.fyFinancials?.[selectedFY || fy] || masterConfig.fyFinancials?.[fy] || {
    hourlyRate: masterConfig.hourlyRate || RATE_PER_HOUR,
    hoursPerMonth: masterConfig.hoursPerMonth || HOURS_PER_MONTH,
    contractedEmployeeRate: masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE,
  };
  optionsSheet.getCell(1, 13).value = "Current Hourly Rate";
  optionsSheet.getCell(2, 13).value = cfgFinancials.hourlyRate;
  optionsSheet.getCell(1, 14).value = "LY Hourly Rate";
  optionsSheet.getCell(2, 14).value = lyRate; // This is 1650 for context FY 26-27
  optionsSheet.getCell(1, 15).value = "Working Hours per Month";
  optionsSheet.getCell(2, 15).value = cfgFinancials.hoursPerMonth;
  optionsSheet.getCell(1, 16).value = "Contracted Employee Rate";
  optionsSheet.getCell(2, 16).value = cfgFinancials.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE;

  // 8. Apply Data Validations & Formatting to Master Sheet (Post-creation)
  const applyMasterValidation = (
    colIndex: number,
    optionCol: number,
    itemsCount: number,
  ) => {
    const letter = getColLetter(optionCol);
    const formula = `_RegistryOptions!$${letter}$2:$${letter}$${itemsCount + 1}`;
    for (let i = dataStartRowIdx; i <= dataEndRowIdx + 100; i++) {
      masterSheet.getCell(i, colIndex).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
      };
    }
  };

  applyMasterValidation(3, 1, 3); // TBC
  applyMasterValidation(4, 2, masterConfig.verticals?.length || 0); // Vertical
  applyMasterValidation(5, 3, masterConfig.projectCategories?.length || 0); // Category
  applyMasterValidation(6, 4, masterConfig.productFamilies?.length || 0); // Family
  applyMasterValidation(9, 5, masterConfig.buDomains?.length || 0); // Domain
  applyMasterValidation(10, 6, masterConfig.businessUnits?.length || 0); // BU
  applyMasterValidation(12, 8, masterConfig.projectTypes?.length || 0); // Type
  applyMasterValidation(13, 11, masterConfig.customers?.length || 0); // Customer
  applyMasterValidation(14, 9, masterConfig.paces?.length || 0); // PACE
  applyMasterValidation(15, 10, masterConfig.segments?.length || 0); // Segment
  applyMasterValidation(19, 7, IG_GATE_OPTIONS.length); // IG Gate

  masterSheet.views = [{ state: "frozen", xSplit: 7, ySplit: 2 }];
  masterSheet.addConditionalFormatting({
    ref: `A3:Z${masterSheet.rowCount}`,
    rules: [
      {
        type: "expression",
        formulae: ['$C3="No"'],
        priority: 1,
        style: {
          font: { color: { argb: "FFFF0000" }, italic: true, strike: true },
        },
      },
    ],
  });

  // 9. Generate and Download
  const now = new Date();
  const YYYYMMDD = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const HHmm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filePrefix = isSingleProject
    ? `${projectsInScope[0].code}_Export`
    : (fiscalMode === "Forecast" ? "Budget" : fiscalMode);
  const fileName = `${filePrefix}_${(selectedFY || "FY_25-26").replace(/\s+/g, "_")}${!isSingleProject ? "_Projects" : ""}_${YYYYMMDD}_${HHmm}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

/**
 * IMPORT LOGIC - BUDGET
 */
export const processExcelImport = async (
  file: File,
  masterConfig: MasterConfigState,
  existingProjects: ProjectData[],
  currentMonths: string[],
  fiscalMode: FiscalMode = "Budget",
  onProgress?: (percent: number, message: string) => void,
  sourceType: "auto" | "zoho" | "processed" = "auto",
  employees: Employee[] = [],
) => {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        onProgress?.(5, "Reading Excel binary...");
        const bstr = evt.target?.result as string;

        // Yield to UI
        await new Promise((r) => setTimeout(r, 0));

        onProgress?.(10, "Parsing workbook structure...");
        const wb = XLSX.read(bstr, { type: "binary" });
        if (!wb.SheetNames || wb.SheetNames.length === 0)
          throw new Error("Excel payload contains no sheets.");

        const norm = (s: string) =>
          (s || "")
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        // 1. Identify Meta Sheet (Project Registry)
        onProgress?.(15, "Identifying project registry...");
        let metaSheetName = wb.SheetNames.find((n) =>
          n.toLowerCase().includes("list"),
        );
        if (!metaSheetName) {
          const validSheets = wb.SheetNames.filter(
            (n) =>
              ![
                "summary",
                "configuration",
                "analytics",
                "incubation index",
              ].includes(n.toLowerCase()),
          );
          metaSheetName =
            validSheets.length > 0 ? validSheets[0] : wb.SheetNames[0];
        }
        if (!metaSheetName) throw new Error("No meta sheet found");
        const wsMeta = wb.Sheets[metaSheetName];
        const rawMetaData = (
          wsMeta ? XLSX.utils.sheet_to_json(wsMeta, { header: "A" }) : []
        ) as any[];

        // Find header row dynamically
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rawMetaData.length, 20); i++) {
          const rowVals = Object.values(rawMetaData[i] || {}).map((v) =>
            String(v).toLowerCase().trim(),
          );
          if (
            rowVals.includes("project code") ||
            rowVals.includes("id") ||
            rowVals.includes("code") ||
            rowVals.includes("project name")
          ) {
            headerRowIdx = i;
            break;
          }
        }
        const finalStartIndex = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;

        // 2. Determine Fiscal Year from currentMonths
        const startMonthStr =
          currentMonths && currentMonths.length > 0
            ? currentMonths[0]
            : "Apr-25";
        const fyStartYearShort = parseInt(startMonthStr.split("-")[1]) || 25;
        const fyStartYear =
          fyStartYearShort < 100 ? 2000 + fyStartYearShort : fyStartYearShort;
        const currentFY = `FY ${fyStartYearShort}-${fyStartYearShort + 1}`;

        const financialConfig = masterConfig.fyFinancials?.[currentFY] || {
          hourlyRate: masterConfig.hourlyRate || RATE_PER_HOUR,
          hoursPerMonth: masterConfig.hoursPerMonth || HOURS_PER_MONTH,
        };
        const ratePerHour = financialConfig.hourlyRate;
        const hoursPerMonth = financialConfig.hoursPerMonth;

        interface FlatProjectData {
          rows: Record<string, number[]>;
          pmoRows: Record<string, number[]>;
          actuals: Record<string, number[]>;
          forecast: Record<string, number[]>;
          igGatesDict: Record<number, string>;
          employeeSkills?: Record<string, Record<string, number[]>>;
          actualsEmployeeSkills?: Record<string, Record<string, number[]>>;
          forecastEmployeeSkills?: Record<string, Record<string, number[]>>;
          employeeBillableHours?: Record<string, number[]>;
          employeeNonBillableHours?: Record<string, number[]>;
          employeeIdleHours?: Record<string, number[]>;
          employeeInfo?: Record<string, any>;
          projectTasks?: Record<string, any[]>;
          employeeTasks?: Record<string, Record<string, any[]>>;
          mappedSummary?: {
            skills: string[];
            expenses: string[];
          };
        }

        // 3. Aggregation Map for "Flat List" (Data Processor) style data
        const flatDataMap: Record<string, FlatProjectData> = {};
        const flatListSheets = new Set<string>();

        // 4. Process all sheets for data
        const totalSheets = wb.SheetNames.length;
        for (let sIdx = 0; sIdx < totalSheets; sIdx++) {
          const sheetName = wb.SheetNames[sIdx];
          const progressBase = 20 + (sIdx / totalSheets) * 40;
          onProgress?.(progressBase, `Processing sheet: ${sheetName}...`);

          // Yield to UI
          await new Promise((r) => setTimeout(r, 0));

          // Skip known non-data sheets if they are not the only sheet
          const lowerSheetName = sheetName.toLowerCase();
          if (
            wb.SheetNames.length > 1 &&
            (lowerSheetName === "summary" ||
              lowerSheetName === "configuration" ||
              lowerSheetName === "analytics" ||
              lowerSheetName === "incubation index" ||
              lowerSheetName.startsWith("_") ||
              lowerSheetName.includes("registryoptions") ||
              lowerSheetName.includes("datavalidation"))
          )
            continue;

          const ws = wb.Sheets[sheetName];
          const sheetRows = (
            ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : []
          ) as any[][];
          if (sheetRows.length === 0) continue;

          let colIndices: any = {
            code: -1,
            name: -1,
            month: -1,
            hours: -1,
            amount: -1,
            bucket: -1,
            type: -1,
            skill: -1,
            vertical: -1,
            creatType: -1,
            productFamily: -1,
            user: -1,
            userEmail: -1,
            billableCheck: -1,
            task: -1,
            taskList: -1,
            employeeType: -1,
            monthPriority: 0,
            amountFound: false,
            isFlatList: false,
          };

          const headerRowIdx = sheetRows.findIndex(
            (row) =>
              Array.isArray(row) &&
              row.some((cell) => {
                const s = String(cell || "").toLowerCase();
                return (
                  s.includes("project code") ||
                  s.includes("project name") ||
                  s.includes("record type") ||
                  s.includes("role hr master 2") ||
                  s.includes("functional unit") ||
                  s === "month" ||
                  s === "hours" ||
                  s === "amount"
                );
              }),
          );

          if (headerRowIdx !== -1) {
            const headerRow = sheetRows[headerRowIdx] || [];
            headerRow.forEach((cell, idx) => {
              const s = String(cell || "")
                .toLowerCase()
                .trim();
              if (
                s.includes("project code") ||
                s === "code" ||
                s === "id" ||
                s === "project_code"
              )
                colIndices.code = idx;
              if (
                s.includes("project name") ||
                s === "name" ||
                s === "project_name"
              )
                colIndices.name = idx;
              if (s === "month" || s === "month-year" || s === "month year") {
                colIndices.month = idx;
                colIndices.monthPriority = 2;
              } else if (
                (s === "date" || s === "period" || s === "month") &&
                colIndices.monthPriority < 2
              ) {
                colIndices.month = idx;
                colIndices.monthPriority = 1;
              }
              if (
                s === "hours" ||
                s === "working hours" ||
                s === "billable hours" ||
                s === "hrs"
              )
                colIndices.hours = idx;
              else if (
                (s === "quantity" || s === "qty" || s === "units") &&
                colIndices.hours === -1
              )
                colIndices.hours = idx;
              if (
                s === "amount" ||
                s === "value" ||
                s === "cost" ||
                s === "total" ||
                s.includes("expense amount") ||
                s.includes("total expense") ||
                s === "actuals" ||
                s.includes("total cost") ||
                s.includes("net cost") ||
                s.includes("manpower cost")
              ) {
                if (
                  s.includes("total expense") ||
                  s.includes("total cost") ||
                  s.includes("net cost") ||
                  !colIndices.amountFound
                ) {
                  colIndices.amount = idx;
                  colIndices.amountFound = true;
                }
              }
              if (
                s.includes("expense bucket") ||
                s === "bucket" ||
                s === "category"
              )
                colIndices.bucket = idx;
              if (
                s.includes("record type") ||
                s === "type" ||
                s === "record_type"
              )
                colIndices.type = idx;
              if (
                s.includes("role hr master 2") ||
                s === "skill" ||
                s.includes("functional unit") ||
                s === "label" ||
                s === "role" ||
                s === "designation"
              )
                colIndices.skill = idx;
              if (s === "vertical") colIndices.vertical = idx;
              if (s === "creat type" || s === "creat_type" || s === "type")
                colIndices.creatType = idx;
              if (
                s.includes("product family") ||
                s.includes("product_family") ||
                s.includes("family")
              )
                colIndices.productFamily = idx;
              if (
                s === "user" ||
                s === "resource name" ||
                s === "employee name" ||
                s === "employee" ||
                s === "resource" ||
                s.includes("resource name") ||
                s.includes("employee name") ||
                (s.includes("user") && !s.includes("mailid") && !s.includes("email"))
              ) {
                colIndices.user = idx;
              }
              if (
                s.includes("mailid") ||
                s === "email" ||
                s.includes("email") ||
                s === "mail"
              ) {
                colIndices.userEmail = idx;
              }
              if (s.includes("billable check")) colIndices.billableCheck = idx;
              if (
                s === "task" ||
                s === "task name" ||
                s === "task_name" ||
                s === "activity" ||
                s === "activity name" ||
                s === "task_description" ||
                s === "description"
              ) {
                if (colIndices.task === -1 || s === "task" || s === "task name")
                  colIndices.task = idx;
              }
              if (
                s === "task list" ||
                s === "task_list" ||
                s === "tasklist" ||
                s === "activity list" ||
                s === "activity_list" ||
                s === "task_group"
              ) {
                if (colIndices.taskList === -1 || s === "task list")
                  colIndices.taskList = idx;
              }
              if (s.includes("employee type") || s === "employee_type")
                colIndices.employeeType = idx;
            });

            const monthHeaderCount = headerRow.filter((cell) => {
              const s = String(cell || "").toLowerCase().trim();
              const mNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
              return mNames.some((m) => s.startsWith(m) && (s.length === 3 || s.includes("-") || s.includes(" ") || !isNaN(Number(s.slice(3)))));
            }).length;

            const isMatrixSheet = monthHeaderCount >= 3;

            if (
              !isMatrixSheet &&
              colIndices.code !== -1 &&
              (colIndices.month !== -1 || colIndices.type !== -1 || sourceType === "zoho" || sourceType === "processed")
            ) {
              colIndices.isFlatList = true;
              flatListSheets.add(sheetName);
            }

            if (colIndices.isFlatList) {
              // Column fallbacks same as PMO.tsx if headers are not found or missing
              if (colIndices.code === -1) colIndices.code = 0;
              if (colIndices.name === -1) colIndices.name = 1;
              if (colIndices.month === -1) colIndices.month = 6;
              if (colIndices.hours === -1) colIndices.hours = 11; // Column L
              if (colIndices.amount === -1) colIndices.amount = 25; // Column Z
              if (colIndices.bucket === -1) colIndices.bucket = 21; // Column V
              if (colIndices.type === -1) colIndices.type = 22; // Column W
              if (colIndices.skill === -1) colIndices.skill = 32; // Column AG
              if (colIndices.vertical === -1) colIndices.vertical = 16; // Column Q
              if (colIndices.creatType === -1) colIndices.creatType = 15; // Column P
              if (colIndices.productFamily === -1) colIndices.productFamily = 14; // Column O
              if (colIndices.user === -1) colIndices.user = 2; // Column C
              if (colIndices.userEmail === -1) colIndices.userEmail = 3; // Column D
              if (colIndices.billableCheck === -1) colIndices.billableCheck = 13; // Column N
              if (colIndices.task === -1) colIndices.task = 9; // Column J
              if (colIndices.taskList === -1) colIndices.taskList = 10; // Column K
              if (colIndices.employeeType === -1) colIndices.employeeType = 30; // Column AE
            }
          }

          if (true) {
            // Process both raw and processed flat lists
            if (!colIndices.isFlatList) {
              if (sourceType === "processed" || sourceType === "zoho") continue;
              console.warn(
                `Required headers (Project Code, Record Type) not found in sheet: ${sheetName}. Skipping.`,
              );
              continue;
            }
            const monthNames = [
              "jan",
              "feb",
              "mar",
              "apr",
              "may",
              "jun",
              "jul",
              "aug",
              "sep",
              "oct",
              "nov",
              "dec",
            ];

            // Process in chunks to avoid blocking
            const CHUNK_SIZE = 5000;
            for (
              let i = headerRowIdx + 1;
              i < sheetRows.length;
              i += CHUNK_SIZE
            ) {
              const chunk = sheetRows.slice(i, i + CHUNK_SIZE);
              onProgress?.(
                progressBase + (i / (sheetRows.length || 1)) * 5,
                `Processing ${i} to ${Math.min(i + CHUNK_SIZE, sheetRows.length)} rows...`,
              );
              await new Promise((r) => setTimeout(r, 0));

              chunk.forEach((row) => {
                if (!row || !Array.isArray(row) || row.length < 2) return;

                let projectCode = String(row[colIndices.code] || "")
                  .trim()
                  .toUpperCase();

                const rawNameForCode = String(row[colIndices.name] || "").trim();
                if (/^\d{4,8}$/.test(projectCode) && /(UMD-\d+|PRJ-\d+|[A-Z]{2,}-\d+)/i.test(rawNameForCode)) {
                  const codeMatch = rawNameForCode.match(/(UMD-\d+|PRJ-\d+|[A-Z]{2,}-\d+)/i);
                  if (codeMatch) {
                    projectCode = codeMatch[0].toUpperCase();
                  }
                }

                if (
                  !projectCode ||
                  projectCode === "PROJECT CODE" ||
                  projectCode.includes("TIMESHEET") ||
                  projectCode.includes("ZOHO") ||
                  projectCode === "CODE" ||
                  projectCode === "ID" ||
                  projectCode === "SYSTEM-ID"
                )
                  return;

                const dateVal = row[colIndices.month];
                if (dateVal === undefined || dateVal === null || dateVal === "")
                  return;

                let date: Date | null = null;
                if (dateVal instanceof Date) {
                  date = dateVal;
                } else if (typeof dateVal === "number") {
                  date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                } else {
                  const dateStr = String(dateVal).trim();
                  const parts = dateStr
                    .toLowerCase()
                    .split(/[-/\s.]/)
                    .filter((p) => p.length > 0);
                  if (parts.length >= 2) {
                    let m = -1,
                      y = -1;
                    for (let j = 0; j < parts.length; j++) {
                      const foundMonth = monthNames.findIndex((name) =>
                        parts[j].startsWith(name),
                      );
                      if (foundMonth !== -1) {
                        m = foundMonth;
                        const otherIdx = j === 0 ? 1 : 0;
                        y = parseInt(parts[otherIdx]);
                        break;
                      }
                    }
                    if (m === -1 && parts.length >= 2) {
                      const p0 = parseInt(parts[0]);
                      const p1 = parseInt(parts[1]);
                      const p2 = parts.length > 2 ? parseInt(parts[2]) : -1;

                      if (p2 > 0) {
                         y = p2;
                         if (p0 > 12 && p1 <= 12) m = p1 - 1;
                         else if (p1 > 12 && p0 <= 12) m = p0 - 1;
                         else m = p0 <= 12 ? p0 - 1 : p1 - 1; 
                      } else if (p0 >= 1 && p0 <= 12 && p1 > 100) {
                        m = p0 - 1;
                        y = p1;
                      } else if (p0 > 100 && p1 >= 1 && p1 <= 12) {
                        y = p0;
                        m = p1 - 1;
                      }
                    }
                    if (m !== -1 && !isNaN(y)) {
                      if (y < 100) y += 2000;
                      date = new Date(Date.UTC(y, m, 1));
                    }
                  }
                  if (!date || isNaN(date.getTime())) date = new Date(dateStr);
                }

                if (!date || isNaN(date.getTime())) return;

                const utcDate = new Date(date.getTime() + 43200000);
                const month = utcDate.getUTCMonth();
                const year = utcDate.getUTCFullYear();
                const monthNamesLong = [
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
                ];
                const monthStr = `${monthNamesLong[month]}-${year.toString().slice(-2)}`;
                const monthIdx = getAbsoluteMonthIndex(monthStr);

                if (monthIdx < 0 || monthIdx >= MAX_MONTHS) return;

                const targetKey =
                  fiscalMode === "Actuals"
                    ? "actuals"
                    : fiscalMode === "Forecast"
                      ? "forecast"
                      : fiscalMode === "PMO_Budget"
                        ? "pmoRows"
                        : "rows";

                const empSkillsKey = fiscalMode === "Actuals"
                  ? "actualsEmployeeSkills"
                  : (fiscalMode === "Forecast"
                    ? "forecastEmployeeSkills"
                    : ((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO" ? "pmoEmployeeSkills" : "employeeSkills"));

                if (!flatDataMap[projectCode]) {
                  flatDataMap[projectCode] = {
                    rows: {},
                    pmoRows: {},
                    actuals: {},
                    forecast: {},
                    igGatesDict: {},
                    employeeSkills: {},
                    actualsEmployeeSkills: {},
                    forecastEmployeeSkills: {},
                    employeeBillableHours: {},
                    employeeNonBillableHours: {},
                    employeeIdleHours: {},
                    employeeInfo: {},
                    projectTasks: {},
                    employeeTasks: {},
                    mappedSummary: { skills: [], expenses: [] },
                  };
                }
                const pData = flatDataMap[projectCode];
                const recordType = String(row[colIndices.type] || "")
                  .trim()
                  .toLowerCase();
                const rawSkill = String(row[colIndices.skill] || "").trim();
                const expBucketRaw = String(
                  row[colIndices.bucket] || "",
                ).trim();
                const employeeType = String(
                  row[colIndices.employeeType] || "",
                ).trim();

                const parseVal = (val: any) => {
                  if (typeof val === "number") return val;
                  if (val === undefined || val === null) return 0;
                  const clean = String(val).replace(/[^0-9.%-]/g, "");
                  if (clean.includes("%"))
                    return (parseFloat(clean.replace("%", "")) || 0) / 100;
                  return parseFloat(clean || "0") || 0;
                };

                const hours = parseVal(row[colIndices.hours]);
                const amount = parseVal(row[colIndices.amount]);

                const user = String(row[colIndices.user] || "").trim();
                const userEmail = String(row[colIndices.userEmail] || "")
                  .trim()
                  .toLowerCase();
                const billableCheck = String(
                  row[colIndices.billableCheck] || "",
                )
                  .trim()
                  .toLowerCase();
                const taskName = String(row[colIndices.task] || "").trim();
                const taskListName = String(
                  row[colIndices.taskList] || "",
                ).trim();

                const isExpense =
                  recordType === "expense" ||
                  recordType === "exp" ||
                  (!recordType.includes("timelog") &&
                    !recordType.includes("time") &&
                    (amount !== 0) && (
                      hours === 0 || 
                      expBucketRaw !== "" || 
                      EXPENSE_CATEGORIES.some(c => norm(c) === norm(rawSkill)) ||
                      EXPENSE_CATEGORIES.some(c => norm(c) === norm(expBucketRaw)) ||
                      (!MANPOWER_CATEGORIES.some(c => norm(c) === norm(rawSkill)) && hours < 5)
                    )
                  );

                const isTimelog =
                  recordType === "timelog" ||
                  recordType === "time" ||
                  (!isExpense && hours > 0);
                const isConsultant = employeeType
                  .toLowerCase()
                  .includes("consultant");

                if (isExpense) {
                  const bucketSource = rawSkill || expBucketRaw || "Others";
                  let bucket = "Others";
                  const normalizedSource = bucketSource.trim().toLowerCase();
                  if (normalizedSource.includes("travel")) bucket = "Travel";
                  else if (normalizedSource.includes("material"))
                    bucket = "Material";
                  else if (
                    normalizedSource.includes("consultant") ||
                    normalizedSource.includes("consultancy") ||
                    normalizedSource.includes("outsourcing") ||
                    normalizedSource === "contracted employee"
                  )
                    bucket = "Contracted Employee";
                  else if (normalizedSource.includes("hr")) bucket = "HR";
                  else if (normalizedSource.includes("admin")) bucket = "Admin";
                  else if (
                    normalizedSource.includes("lab") &&
                    !normalizedSource.includes("engineer")
                  )
                    bucket = "Labs";
                  else if (normalizedSource.includes("license"))
                    bucket = "License";
                  else {
                    const mapped =
                      EXPENSE_MAPPING[bucketSource] || bucketSource;
                    const eCat = EXPENSE_CATEGORIES.find(
                      (c) => norm(c) === norm(mapped),
                    );
                    bucket = eCat || mapped;
                  }

                  if (!pData[targetKey][bucket])
                    pData[targetKey][bucket] = new Array(MAX_MONTHS).fill(0);

                  // Update mappedSummary
                  if (!pData.mappedSummary)
                    pData.mappedSummary = { skills: [], expenses: [] };
                  if (!pData.mappedSummary.expenses.includes(bucket))
                    pData.mappedSummary.expenses.push(bucket);

                  if (bucket === "Contracted Employee") {
                    const rate =
                      masterConfig.fyFinancials?.[currentFY]
                        ?.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE;
                    const hpm =
                      masterConfig.fyFinancials?.[currentFY]?.hoursPerMonth ||
                      HOURS_PER_MONTH;
                    // Store as MM for contracted employees
                    if (sourceType === "processed") {
                      pData[targetKey][bucket][monthIdx] += amount; // Already MM in processed export
                    } else {
                      pData[targetKey][bucket][monthIdx] +=
                        amount / (rate * hpm);
                    }
                  } else {
                    // Store as INR in state (Dashboard/App divide by 10^7 for display)
                    if (sourceType === "processed") {
                      pData[targetKey][bucket][monthIdx] += amount * 10000000; // Convert Crores back to INR
                    } else {
                      pData[targetKey][bucket][monthIdx] += amount;
                    }
                  }
                } else if (isTimelog) {
                  let derivedSkill = "";
                  let finalEmail = userEmail;
                  const lookupStr = userEmail || user || "";
                  
                  if (employees && employees.length > 0 && lookupStr) {
                     const emp = employees.find(e => 
                        (userEmail && ((e.email || "").trim().toLowerCase() === userEmail.toLowerCase() || (e.id || "").trim().toLowerCase() === userEmail.toLowerCase())) ||
                        (user && (e.name || "").trim().toLowerCase() === user.toLowerCase())
                     );
                     if (emp) {
                         if (!finalEmail && emp.email) finalEmail = emp.email.toLowerCase();
                         if (emp.skillLevel2) {
                            derivedSkill = emp.skillLevel2;
                         } else if (emp.skill) {
                            derivedSkill = emp.skill;
                         }
                     }
                  }

                  if (!derivedSkill) {
                     derivedSkill = rawSkill;
                  }

                  let skill = SKILL_MAPPING[derivedSkill] || derivedSkill;

                  if (
                    skill === "Contracted Employee" ||
                    skill === "Contracted Employee(CUSTOM)" ||
                    skill === "Consultant" ||
                    isConsultant
                  ) {
                    // Treat as expense
                    if (!pData[targetKey]["Contracted Employee"])
                      pData[targetKey]["Contracted Employee"] = new Array(
                        MAX_MONTHS,
                      ).fill(0);

                    // Update mappedSummary
                    if (!pData.mappedSummary)
                      pData.mappedSummary = { skills: [], expenses: [] };
                    if (
                      !pData.mappedSummary.expenses.includes(
                        "Contracted Employee",
                      )
                    )
                      pData.mappedSummary.expenses.push("Contracted Employee");

                    // Store MM
                    const fyHpm =
                      masterConfig.fyFinancials?.[currentFY]?.hoursPerMonth ||
                      masterConfig.hoursPerMonth ||
                      HOURS_PER_MONTH;
                    pData[targetKey]["Contracted Employee"][monthIdx] +=
                      hours / (fyHpm || 180);
                    skill = "Contracted Employee";
                  } else {
                    const mCat = MANPOWER_CATEGORIES.find(
                      (c) => c.toLowerCase().trim() === skill.toLowerCase().trim() || norm(c) === norm(skill),
                    );
                    if (mCat) skill = mCat;
                    else {
                      // Fallback: search in SKILL_MAPPING more aggressively
                      const mappedKey = Object.keys(SKILL_MAPPING).find(k => k.toLowerCase().trim() === skill.toLowerCase().trim());
                      if (mappedKey) {
                        const mappedVal = SKILL_MAPPING[mappedKey];
                        const mCatMapped = MANPOWER_CATEGORIES.find(c => c.toLowerCase().trim() === mappedVal.toLowerCase().trim());
                        if (mCatMapped) skill = mCatMapped;
                      }
                    }
                    
                    if (!MANPOWER_CATEGORIES.includes(skill as any) && skill !== "Unspecified Skill") {
                       // Try to find if it SHOULD be unspecified
                       if (!MANPOWER_CATEGORIES.some(c => c.toLowerCase() === skill.toLowerCase())) {
                          skill = "Unspecified Skill";
                       }
                    }
                    if (!pData[targetKey][skill])
                      pData[targetKey][skill] = new Array(MAX_MONTHS).fill(0);

                    // Update mappedSummary
                    if (!pData.mappedSummary)
                      pData.mappedSummary = { skills: [], expenses: [] };
                    if (!pData.mappedSummary.skills.includes(skill))
                      pData.mappedSummary.skills.push(skill);

                    const fyHpm =
                      masterConfig.fyFinancials?.[currentFY]?.hoursPerMonth ||
                      masterConfig.hoursPerMonth ||
                      HOURS_PER_MONTH;
                    pData[targetKey][skill][monthIdx] += hours / (fyHpm || 180);
                  }

                  // Employee Roster Data
                  if (finalEmail) {
                    const emailLower = finalEmail.toLowerCase();
                    const skillsMap = pData[empSkillsKey] as Record<string, Record<string, number[]>>;
                    if (!skillsMap[skill])
                      skillsMap[skill] = {};
                    if (!skillsMap[skill][emailLower])
                      skillsMap[skill][emailLower] = new Array(
                        MAX_MONTHS,
                      ).fill(0);

                    const fyHpm =
                      masterConfig.fyFinancials?.[currentFY]?.hoursPerMonth ||
                      masterConfig.hoursPerMonth ||
                      HOURS_PER_MONTH;
                    skillsMap[skill][emailLower][monthIdx] +=
                      hours / (fyHpm || 180);

                    // Extract Task Info
                    if (taskListName && taskName) {
                      const hpm =
                        masterConfig.fyFinancials?.[currentFY]?.hoursPerMonth ||
                        masterConfig.hoursPerMonth ||
                        HOURS_PER_MONTH;
                      const taskPct = hours / (hpm || 180);

                      if (!pData.projectTasks) pData.projectTasks = {};
                      if (!pData.projectTasks[taskListName])
                        pData.projectTasks[taskListName] = [];

                      const existingTask = pData.projectTasks[
                        taskListName
                      ].find((t) => t.name === taskName);
                      if (existingTask) {
                        existingTask.hours += hours;
                        existingTask.percentage = existingTask.hours / hpm;
                        if (!existingTask.monthlyAllocations)
                          existingTask.monthlyAllocations = new Array(
                            MAX_MONTHS,
                          ).fill(0);
                        if (!existingTask.monthlyHours)
                          existingTask.monthlyHours = new Array(
                            MAX_MONTHS,
                          ).fill(0);
                        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
                          existingTask.monthlyAllocations[monthIdx] += taskPct;
                          existingTask.monthlyHours[monthIdx] += hours;
                        }
                      } else {
                        const monthlyAllocations = new Array(MAX_MONTHS).fill(
                          0,
                        );
                        const monthlyHours = new Array(MAX_MONTHS).fill(0);
                        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
                          monthlyAllocations[monthIdx] = taskPct;
                          monthlyHours[monthIdx] = hours;
                        }
                        pData.projectTasks[taskListName].push({
                          name: taskName,
                          hours: hours,
                          percentage: hours / hpm,
                          monthlyAllocations,
                          monthlyHours,
                        });
                      }

                      // Group tasks by employee and task list
                      if (!pData.employeeTasks) pData.employeeTasks = {};
                      if (!pData.employeeTasks[emailLower])
                        pData.employeeTasks[emailLower] = {};
                      if (!pData.employeeTasks[emailLower][taskListName])
                        pData.employeeTasks[emailLower][taskListName] = [];

                      const existingEmpTask = pData.employeeTasks[emailLower][
                        taskListName
                      ].find((t) => t.name === taskName);
                      if (existingEmpTask) {
                        existingEmpTask.hours += hours;
                        existingEmpTask.percentage =
                          existingEmpTask.hours / hpm;
                        if (!existingEmpTask.monthlyAllocations)
                          existingEmpTask.monthlyAllocations = new Array(
                            MAX_MONTHS,
                          ).fill(0);
                        if (!existingEmpTask.monthlyHours)
                          existingEmpTask.monthlyHours = new Array(
                            MAX_MONTHS,
                          ).fill(0);
                        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
                          existingEmpTask.monthlyAllocations[monthIdx] +=
                            taskPct;
                          existingEmpTask.monthlyHours[monthIdx] += hours;
                        }
                      } else {
                        const monthlyAllocations = new Array(MAX_MONTHS).fill(
                          0,
                        );
                        const monthlyHours = new Array(MAX_MONTHS).fill(0);
                        if (monthIdx >= 0 && monthIdx < MAX_MONTHS) {
                          monthlyAllocations[monthIdx] = taskPct;
                          monthlyHours[monthIdx] = hours;
                        }
                        pData.employeeTasks[emailLower][taskListName].push({
                          name: taskName,
                          hours: hours,
                          percentage: hours / hpm,
                          monthlyAllocations,
                          monthlyHours,
                        });
                      }
                    }

                    if (!pData.employeeBillableHours[emailLower])
                      pData.employeeBillableHours[emailLower] = new Array(
                        MAX_MONTHS,
                      ).fill(0);
                    if (!pData.employeeNonBillableHours[emailLower])
                      pData.employeeNonBillableHours[emailLower] = new Array(
                        MAX_MONTHS,
                      ).fill(0);
                    if (!pData.employeeIdleHours[emailLower])
                      pData.employeeIdleHours[emailLower] = new Array(
                        MAX_MONTHS,
                      ).fill(0);

                    if (
                      billableCheck === "yes" ||
                      billableCheck === "true" ||
                      billableCheck === "billable" ||
                      billableCheck === "y"
                    ) {
                      pData.employeeBillableHours[emailLower][monthIdx] +=
                        hours;
                    } else {
                      pData.employeeNonBillableHours[emailLower][monthIdx] +=
                        hours;
                    }

                    if (taskName.toLowerCase().includes("idle")) {
                      pData.employeeIdleHours[emailLower][monthIdx] += hours;
                    }

                    if (!pData.employeeInfo[emailLower]) {
                      pData.employeeInfo[emailLower] = {
                        name: user,
                        email: emailLower,
                        skill: skill,
                        skillLevel2: rawSkill,
                        category: isConsultant
                          ? "Contracted Employee"
                          : "Direct Employee",
                      };
                    }
                  }
                }
              });
            }
          }
        }

        // 5. Final Project Assembly
        onProgress?.(80, "Assembling final project registry...");
        await new Promise((r) => setTimeout(r, 0));

        const headerRow = rawMetaData[finalStartIndex - 1] || {};
        const systemIdCol = Object.keys(headerRow).find((key) =>
          String(headerRow[key]).toLowerCase().includes("system-id"),
        );

        let tbcCol = "",
          verticalCol = "",
          categoryCol = "",
          nameCol = "",
          codeCol = "B",
          productFamilyCol = "",
          buDomainCol = "",
          businessUnitCol = "",
          pdhCol = "",
          projectTypeCol = "",
          customerCol = "",
          paceCol = "",
          segmentCol = "",
          sopCol = "",
          currentGateCol = "",
          prevYearBudgetCol = "",
          expenseTillMar26Col = "",
          remarksCol = "",
          startDateCol = "";
        Object.keys(headerRow).forEach((key) => {
          const val = String(headerRow[key]).toLowerCase().trim();
          if (val === "tbc") tbcCol = key;
          if (val === "vertical") verticalCol = key;
          if (val === "category") categoryCol = key;
          if (val === "project name" || val === "name") nameCol = key;
          if (
            val === "project code" ||
            val === "code" ||
            val === "id" ||
            val === "system-id"
          )
            codeCol = key;
          if (
            val.includes("product family") ||
            val.includes("product_family") ||
            val.includes("family")
          )
            productFamilyCol = key;
          if (val === "bu domain" || val === "domain") buDomainCol = key;
          if (val === "business unit" || val === "bu") businessUnitCol = key;
          if (val === "pdh") pdhCol = key;
          if (val === "project type" || val === "type") projectTypeCol = key;
          if (val === "customer") customerCol = key;
          if (val === "pace") paceCol = key;
          if (val === "segment") segmentCol = key;
          if (val === "sop") sopCol = key;
          if (val === "current gate" || val === "ig gate") currentGateCol = key;
          if (val === "prev year budget" || val.includes("prev. allocated"))
            prevYearBudgetCol = key;
          if (val === "expense till mar 26" || val.includes("exp till mar-26"))
            expenseTillMar26Col = key;
          if (val === "remarks" || val.includes("remark")) remarksCol = key;
          if (val === "start date" || val === "start_date") startDateCol = key;
        });

        const seenCodes = new Set<string>();
        const projectsWithStatus = rawMetaData
          .slice(finalStartIndex)
          .reduce((acc: any[], row: any, rIdx: number) => {
            if (rIdx % 100 === 0)
              onProgress?.(
                80 + (rIdx / (rawMetaData.length || 1)) * 15,
                `Assembling project ${rIdx}...`,
              );

            const pCode = (row?.[codeCol] || row?.B || "").toString().trim();
            if (!pCode) return acc;
            // seenCodes.add(pCode.toUpperCase()); // Removed strict duplicate check

            const uuid = systemIdCol
              ? (row?.[systemIdCol] || "").toString().trim()
              : (row?.A || "").toString().trim();
            const rawRemarksText = remarksCol
              ? (row?.[remarksCol] || "").toString().trim()
              : (row?.W || "").toString().trim();
            const isJunk =
              !rawRemarksText ||
              rawRemarksText.toLowerCase() === "undefined" ||
              rawRemarksText.toLowerCase() === "null" ||
              rawRemarksText.length < 2 ||
              !isNaN(Number(rawRemarksText));
            const validRemark = !isJunk ? rawRemarksText : "";

            const p: any = {
              id: uuid || generateUUID(),
              vertical: verticalCol
                ? (row[verticalCol] || "").toString().trim()
                : undefined,
              category: categoryCol
                ? (row[categoryCol] || "New").toString().trim()
                : undefined,
              productFamily: productFamilyCol
                ? (row[productFamilyCol] || "NA").toString().trim()
                : undefined,
              name: nameCol
                ? (row[nameCol] || "").toString().trim()
                : undefined,
              buDomain: buDomainCol
                ? (row[buDomainCol] || "").toString().trim()
                : undefined,
              businessUnit: businessUnitCol
                ? (row[businessUnitCol] || "NA").toString().trim()
                : undefined,
              pdh: pdhCol ? (row[pdhCol] || "").toString().trim() : undefined,
              projectType: projectTypeCol
                ? (row[projectTypeCol] || "NA").toString().trim()
                : undefined,
              customer: customerCol
                ? (row[customerCol] || "").toString().trim()
                : undefined,
              pace: paceCol
                ? (row[paceCol] || "NA").toString().trim()
                : undefined,
              segment: segmentCol
                ? (row[segmentCol] || "NA").toString().trim()
                : undefined,
              sopMonth: sopCol
                ? String(row[sopCol] || "").split(" ")[0] ||
                  currentMonths?.[0] ||
                  "Apr"
                : undefined,
              sopFyYear: sopCol
                ? String(row[sopCol] || "").split(" ")[1] || "FY 25"
                : undefined,
              tbc: tbcCol
                ? (["no", "n", "false", "0", "not tbc"].includes(String(row[tbcCol] || "").trim().toLowerCase()) ? "No" : "Yes")
                : "Yes",
              currentGate: currentGateCol
                ? (row[currentGateCol] || "TBD").toString().trim()
                : undefined,
              prevYearBudget: prevYearBudgetCol
                ? parseFloat(row[prevYearBudgetCol]) || 0
                : undefined,
              expenseTillMar26: expenseTillMar26Col
                ? parseFloat(row[expenseTillMar26Col]) || 0
                : undefined,
              remarks: validRemark
                ? [
                    {
                      text: validRemark,
                      username: "Import",
                      timestamp: Date.now(),
                      userId: "sys",
                    },
                  ]
                : [],
              startDate: startDateCol
                ? row[startDateCol] || undefined
                : undefined,
              code: pCode,
              rows: {},
              pmoRows: {},
              actuals: {},
              forecast: {},
              mappedSummary: { skills: [], expenses: [] },
              projectTasks: {},
              employeeTasks: {},
              isLocked: false,
              igGates: Array(MAX_MONTHS).fill(""),
            };

            const targetKey =
              fiscalMode === "Actuals"
                ? "actuals"
                : fiscalMode === "Forecast"
                  ? "forecast"
                  : fiscalMode === "PMO_Budget"
                    ? "pmoRows"
                    : "rows";
            let hasEstimationData = false;

            // Merge Flat List Data if available
            if (flatDataMap[pCode.toUpperCase()]) {
              const fData = flatDataMap[pCode.toUpperCase()];
              p.rows = fData.rows || {};
              p.pmoRows = fData.pmoRows || {};
              p.actuals = fData.actuals;
              p.forecast = fData.forecast;
              p.igGatesDict = fData.igGatesDict;
              p.projectTasks = fData.projectTasks || {};
              p.employeeTasks = fData.employeeTasks || {};
              p.employeeSkills = fData.employeeSkills;
              p.actualsEmployeeSkills = fData.actualsEmployeeSkills;
              p.forecastEmployeeSkills = fData.forecastEmployeeSkills;
              p.employeeBillableHours = fData.employeeBillableHours;
              p.employeeNonBillableHours = fData.employeeNonBillableHours;
              p.employeeIdleHours = fData.employeeIdleHours;
              p.employeeInfo = fData.employeeInfo;
              p.mappedSummary = fData.mappedSummary;
              if (Object.keys(p[targetKey]).length > 0)
                hasEstimationData = true;
            }

            // Fallback to Master Style logic for other sheets if no flat data or to supplement
            if (sourceType !== "zoho") {
              wb.SheetNames.forEach((sheetName) => {
                if (flatListSheets.has(sheetName)) return;
                if (
                  sheetName === metaSheetName ||
                  sheetName === "Project List" ||
                  sheetName === "Project Registry" ||
                  sheetName.toLowerCase() === "employee list" ||
                  sheetName.toLowerCase() === "resource matrix" ||
                  sheetName.toLowerCase() === "configuration" ||
                  sheetName.toLowerCase() === "analytics" ||
                  sheetName.toLowerCase() === "incubation index" ||
                  sheetName.toLowerCase() === "summary" || sheetName.toLowerCase().includes("dashboard") || sheetName.toLowerCase().includes("pareto") || sheetName.toLowerCase().includes("hr") || sheetName.toLowerCase().startsWith("_")
                )
                  return;
                const ws = wb.Sheets[sheetName];
                const sheetRows = (
                  ws ? XLSX.utils.sheet_to_json(ws, { header: "A" }) : []
                ) as any[];
                if (sheetRows.length === 0) return;

                let headerRow: any = sheetRows[0] || {};
                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(10, sheetRows.length); i++) {
                  const row = sheetRows[i];
                  const hasCode = Object.values(row).some((v) => {
                    const str = String(v || "")
                      .toLowerCase()
                      .trim();
                    return (
                      str === "project code" ||
                      str === "code" ||
                      str === "id" ||
                      str === "system-id"
                    );
                  });
                  if (hasCode) {
                    headerRow = row;
                    headerRowIdx = i;
                    break;
                  }
                }

                const allMonths = getMultiYearMonths();
                const monthCols: { col: string; monthIdx: number }[] = [];

                let idCol = "B",
                  labelCol = "H",
                  typeCol = "W",
                  roleCol = "AG",
                  systemIdCol = "A",
                  userEmailCol = "",
                  userNameCol = "",
                  nameCol = "",
                  aggTotalCol = "U";

                Object.keys(headerRow).forEach((colKey) => {
                  const headerVal = String(headerRow[colKey] || "")
                    .trim()
                    .toLowerCase();
                  if (
                    headerVal.includes("project code") ||
                    headerVal === "code" ||
                    headerVal === "id" ||
                    headerVal === "project_code"
                  )
                    idCol = colKey;
                  if (
                    headerVal.includes("system-id") ||
                    headerVal === "system id"
                  )
                    systemIdCol = colKey;
                  if (
                    headerVal.includes("project name") ||
                    headerVal === "name" ||
                    headerVal === "project_name"
                  )
                    nameCol = colKey;
                  if (
                    headerVal.includes("functional unit / label") ||
                    headerVal === "label" ||
                    headerVal.includes("functional unit") ||
                    headerVal === "role" ||
                    headerVal === "skill"
                  )
                    labelCol = colKey;
                  if (
                    headerVal.includes("type") ||
                    headerVal.includes("record type") ||
                    headerVal === "record_type"
                  )
                    typeCol = colKey;
                  if (
                    headerVal.includes("role hr master 2") ||
                    headerVal === "role" ||
                    headerVal === "skill" ||
                    headerVal === "designation"
                  )
                    roleCol = colKey;
                  if (headerVal === "email" || headerVal === "mailid" || headerVal.includes("email"))
                    userEmailCol = colKey;
                  if (headerVal === "resource name" || headerVal === "employee name" || headerVal === "user" || headerVal.includes("employee"))
                    userNameCol = colKey;
                  if (headerVal === "agg. total" || headerVal === "total")
                    aggTotalCol = colKey;
                  let mIdx = allMonths.findIndex(
                    (m) => m.toLowerCase() === headerVal || m.toLowerCase().replace('-', '') === headerVal.replace(/[^a-z0-9]/g, '')
                  );
                  if (mIdx === -1) {
                    const normH = headerVal.replace(/[^a-z0-9]/g, '');
                    const stdMonths = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
                    const sIdx = stdMonths.indexOf(normH);
                    if (sIdx !== -1) {
                      const startOff = getAbsoluteMonthIndex(startMonth);
                      mIdx = startOff + sIdx;
                    } else {
                      mIdx = allMonths.findIndex((m) => {
                        const mNorm = m.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return mNorm === normH || mNorm.replace(/(\d{2})$/, '20$1') === normH || normH.replace(/(\d{2})$/, '20$1') === mNorm;
                      });
                    }
                  }
                  if (mIdx !== -1 && mIdx < MAX_MONTHS)
                    monthCols.push({ col: colKey, monthIdx: mIdx });
                });

                const sheetNameNorm = sheetName.trim().toLowerCase();
                const pCodeNorm = pCode.trim().toLowerCase();
                const pNameNorm = (p.name || "").trim().toLowerCase();
                const isProjectSheet = sheetNameNorm === pCodeNorm || sheetNameNorm === pNameNorm || sheetNameNorm === "summary" || sheetNameNorm.includes("budget");

                const useFallback = monthCols.length === 0;
                const fallbackCols = [
                  "I",
                  "J",
                  "K",
                  "L",
                  "M",
                  "N",
                  "O",
                  "P",
                  "Q",
                  "R",
                  "S",
                  "T",
                ];
                const startMonth =
                  currentMonths && currentMonths.length > 0
                    ? currentMonths[0]
                    : "Apr-25";
                const yearOffset = getAbsoluteMonthIndex(startMonth);

                let isSheetCrores = false;
                for (let i = headerRowIdx + 1; i < Math.min(sheetRows.length, headerRowIdx + 100); i++) {
                   const sRow = sheetRows[i];
                   if (!sRow) continue;
                   const label = String(sRow[labelCol] || "").toLowerCase();
                   if (label.includes("(crs)") || label.includes("(cr)") || label.includes("(crores)")) {
                      isSheetCrores = true;
                      break;
                   }
                }

                sheetRows.forEach((sRow, rowIdx) => {
                  if (rowIdx <= headerRowIdx || !sRow) return;
                  const rowCode = sRow[idCol]?.toString().trim() || "";
                  const rowName = nameCol ? (sRow[nameCol]?.toString().trim() || "") : "";
                  const sysIdMatch = uuid && sRow[systemIdCol]?.toString().trim() === uuid;
                  const codeMatch = pCode && rowCode.toUpperCase() === pCode.toUpperCase();
                  const nameMatch = p.name && rowName.toLowerCase() === p.name.toLowerCase();
                  const isGenericCode = !pCode || pCode.toUpperCase() === "UMD-XXXX" || pCode.toUpperCase() === "TBD" || pCode.toUpperCase() === "NEW" || pCode.toUpperCase().includes("XXXX");
                  
                  let rowMatch = false;
                  if (sysIdMatch) {
                     rowMatch = true;
                  } else if (isProjectSheet && !rowCode && !rowName) {
                     rowMatch = true;
                  } else if (p.name && rowName) {
                     const normPName = (p.name || "").toLowerCase().trim();
                     const normRName = rowName.toLowerCase().trim();
                     const namesMatch = normPName === normRName || normPName.includes(normRName) || normRName.includes(normPName);
                     if (isGenericCode) {
                        rowMatch = namesMatch;
                     } else {
                        rowMatch = codeMatch && namesMatch;
                     }
                  } else {
                     rowMatch = codeMatch;
                  }
                  
                  if (rowMatch) {
                    let categoryLabel = (sRow[labelCol] || "")
                      .toString()
                      .trim();
                    const recordType = (sRow[typeCol] || "")
                      .toString()
                      .trim()
                      .toLowerCase();

                    const rowUserEmail = (userEmailCol && sRow[userEmailCol]) ? String(sRow[userEmailCol]).trim().toLowerCase() : "";
                    const rowUserName = (userNameCol && sRow[userNameCol]) ? String(sRow[userNameCol]).trim().toLowerCase() : "";

                    let candidateSkill = categoryLabel;
                    if (employees && employees.length > 0 && (rowUserEmail || rowUserName) && recordType !== "expense" && recordType !== "exp") {
                        const emp = employees.find(e => 
                           (rowUserEmail && ((e.email || "").trim().toLowerCase() === rowUserEmail || (e.id || "").trim().toLowerCase() === rowUserEmail)) ||
                           (rowUserName && (e.name || "").trim().toLowerCase() === rowUserName)
                        );
                        if (emp) {
                            if (emp.skill && emp.skill !== "Unspecified Skill" && emp.skill !== "NA") {
                                candidateSkill = emp.skill;
                            } else if (emp.skillLevel2 && emp.skillLevel2 !== "Unspecified Skill" && emp.skillLevel2 !== "NA") {
                                candidateSkill = emp.skillLevel2;
                            }
                        }
                    }

                    if (!candidateSkill || candidateSkill === "Unspecified Skill" || candidateSkill === "NA") {
                        candidateSkill = categoryLabel;
                    }

                    if (recordType === "expense" || recordType === "exp") {
                      categoryLabel = (sRow[roleCol] || "").toString().trim();
                    } else {
                      categoryLabel = normalizeSkill(candidateSkill);
                    }
                    const normalizedLabel = norm(categoryLabel);
                    const rawLabelLower = categoryLabel.toLowerCase();
                    const isSummaryOrAggRow =
                      isSummaryOrCalculatedLabel(categoryLabel) ||
                      isSummaryOrCalculatedLabel(candidateSkill);

                    if (isSummaryOrAggRow) {
                      return;
                    }

                    let mCat = MANPOWER_CATEGORIES.find(
                      (normC) => norm(normC) === normalizedLabel,
                    );
                    let eCat = EXPENSE_CATEGORIES.find(
                      (normC) => norm(normC) === normalizedLabel,
                    );
                    let isExpense =
                      (recordType === "expense" || recordType === "exp") ||
                      (!mCat && (
                        normalizedLabel.includes("travel") ||
                        normalizedLabel.includes("material") ||
                        normalizedLabel.includes("consultant") ||
                        normalizedLabel.includes("lab") ||
                        normalizedLabel.includes("license") ||
                        normalizedLabel.includes("outsourcing") ||
                        normalizedLabel.includes("opex") ||
                        normalizedLabel.includes("expense") ||
                        eCat !== undefined
                      ));

                    if (sourceType === "processed" && !mCat && !isExpense) {
                      mCat = categoryLabel || "Unspecified Skill";
                    }

                    if (!mCat && !eCat && !isExpense && categoryLabel) {
                      mCat = categoryLabel;
                    }

                    if (!eCat && isExpense) {
                      if (normalizedLabel.includes("travel")) eCat = "Travel";
                      else if (normalizedLabel.includes("material") && !mCat)
                        eCat = "Material";
                      else if (
                        normalizedLabel.includes("consultant") ||
                        normalizedLabel.includes("consultancy") ||
                        normalizedLabel.includes("outsourcing") ||
                        normalizedLabel === "contracted employee"
                      )
                        eCat = "Contracted Employee";
                      else if (normalizedLabel.includes("hr")) eCat = "HR";
                      else if (normalizedLabel.includes("admin"))
                        eCat = "Admin";
                      else if (
                        normalizedLabel.includes("lab") &&
                        !normalizedLabel.includes("engineer") &&
                        !mCat
                      )
                        eCat = "Labs";
                      else if (normalizedLabel.includes("license"))
                        eCat = "License";
                      else if (normalizedLabel.includes("operationalexpense") || normalizedLabel.includes("opex"))
                        eCat = "Operational Expenses (Cr)";
                      else eCat = categoryLabel || "Others";
                    }

                    const isIGGate =
                      normalizedLabel.includes("iggateplanning") ||
                      normalizedLabel.includes("gates");

                    if (userEmailCol && sRow[userEmailCol]) {
                      hasEstimationData = true;
                      
                      const sheetNameLower = sheetName.toLowerCase();
                      let empSkillsKey = fiscalMode === "Actuals"
                        ? "actualsEmployeeSkills"
                        : (fiscalMode === "Forecast"
                          ? "forecastEmployeeSkills"
                          : (((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO") ? "pmoEmployeeSkills" : "employeeSkills"));
                      if (sheetNameLower.includes("actuals")) {
                        empSkillsKey = "actualsEmployeeSkills";
                      } else if (sheetNameLower.includes("forecast")) {
                        empSkillsKey = "forecastEmployeeSkills";
                      } else if ((sheetNameLower.includes("pmo rows") || sheetNameLower.includes("pmo")) && ((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO")) {
                        empSkillsKey = "pmoEmployeeSkills";
                      } else if (sheetNameLower.includes("budget") || sheetNameLower.includes("summary")) {
                        empSkillsKey = ((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO") ? "pmoEmployeeSkills" : "employeeSkills";
                      }
                      
                      const emailRaw = String(sRow[userEmailCol]).trim();
                      const email = emailRaw.toLowerCase();
                      const name = userNameCol ? String(sRow[userNameCol] || emailRaw).trim() : emailRaw;
                      
                      const sLabel = mCat || eCat || "Unspecified Skill";

                      if (!p[empSkillsKey]) p[empSkillsKey] = {};
                      const sMap = p[empSkillsKey];
                      if (!sMap[sLabel]) sMap[sLabel] = {};
                      if (!sMap[sLabel][email]) sMap[sLabel][email] = new Array(MAX_MONTHS).fill(0);
                      
                      if (!p.employeeInfo) p.employeeInfo = {};
                      if (!p.employeeInfo[email]) p.employeeInfo[email] = { name, email, skill: sLabel };
                      
                      if (!useFallback && monthCols.length > 0) {
                        monthCols.forEach(({ col, monthIdx }) => {
                          const val = sRow[col];
                          sMap[sLabel][email][monthIdx] = parseCellValue(val);
                        });
                      } else {
                        fallbackCols.forEach((col, i) => {
                          sMap[sLabel][email][i + yearOffset] = parseCellValue(sRow[col]);
                        });
                      }
                      return; // Do not double count in typical metric aggregate rows
                    }

                    if (mCat || eCat || isIGGate) {
                      hasEstimationData = true;
                      
                      let sTargetKey = targetKey;
                      const sheetNameLower = sheetName.toLowerCase();
                      if (sheetNameLower.includes("actuals")) {
                        sTargetKey = "actuals";
                      } else if (sheetNameLower.includes("forecast")) {
                        sTargetKey = "forecast";
                      } else if ((sheetNameLower.includes("pmo rows") || sheetNameLower.includes("pmo")) && ((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO")) {
                        sTargetKey = "pmoRows";
                      } else if (sheetNameLower.includes("budget") || sheetNameLower.includes("summary")) {
                        sTargetKey = ((fiscalMode as any) === "PMO_Budget" || (fiscalMode as any) === "PMO") ? "pmoRows" : "rows";
                      }

                      if (mCat || eCat) {
                        if (!p[sTargetKey]) p[sTargetKey] = {};
                        const targetDict = mCat
                          ? (p[sTargetKey][mCat] =
                              p[sTargetKey][mCat] ||
                              new Array(MAX_MONTHS).fill(0))
                          : (p[sTargetKey][eCat] =
                              p[sTargetKey][eCat] ||
                              new Array(MAX_MONTHS).fill(0));

                        // Update mappedSummary
                        if (!p.mappedSummary)
                          p.mappedSummary = { skills: [], expenses: [] };
                        if (mCat && !p.mappedSummary.skills.includes(mCat))
                          p.mappedSummary.skills.push(mCat);
                        if (eCat && !p.mappedSummary.expenses.includes(eCat))
                          p.mappedSummary.expenses.push(eCat);

                        let rowSum = 0;
                        if (useFallback) {
                          fallbackCols.forEach((col, i) => {
                            const val = sRow[col];
                            let parsed = parseCellValue(val);
                            if (
                              eCat &&
                              eCat !== "Contracted Employee" &&
                              (sourceType === "processed" || (sourceType === "auto" && isSheetCrores))
                            ) {
                              parsed *= 10000000; // Convert Crores back to INR
                            }
                            rowSum += parsed;
                            targetDict[i + yearOffset] += parsed;
                          });
                        } else {
                          monthCols.forEach(({ col, monthIdx }) => {
                            const val = sRow[col];
                            let parsed = parseCellValue(val);
                            if (
                              eCat &&
                              eCat !== "Contracted Employee" &&
                              (sourceType === "processed" || (sourceType === "auto" && isSheetCrores))
                            ) {
                              parsed *= 10000000; // Convert Crores back to INR
                            }
                            rowSum += Math.abs(parsed);
                            targetDict[monthIdx] += parsed;
                          });
                        }
                        
                        if (rowSum === 0 && sRow[aggTotalCol] !== undefined) {
                          let aggParsed = parseCellValue(sRow[aggTotalCol]);
                          if (aggParsed !== 0) {
                            if (eCat && eCat !== "Contracted Employee" && (sourceType === "processed" || (sourceType === "auto" && isSheetCrores))) {
                              aggParsed *= 10000000;
                            }
                            const monthsToFill = useFallback ? fallbackCols.length : (monthCols.length || 12);
                            const perMonth = aggParsed / monthsToFill;
                            if (useFallback) {
                              fallbackCols.forEach((col, i) => { targetDict[i + yearOffset] += perMonth; });
                            } else {
                              if (monthCols.length > 0) {
                                monthCols.forEach(({ monthIdx }) => { targetDict[monthIdx] += perMonth; });
                              }
                            }
                          }
                        }
                      } else if (isIGGate) {
                        const gatesDict = (p.igGatesDict =
                          p.igGatesDict || new Array(MAX_MONTHS).fill(""));
                        if (useFallback) {
                          fallbackCols.forEach((col, i) => {
                            gatesDict[i + yearOffset] = (sRow[col] || "")
                              .toString()
                              .trim();
                          });
                        } else {
                          monthCols.forEach(({ col, monthIdx }) => {
                            gatesDict[monthIdx] = (sRow[col] || "")
                              .toString()
                              .trim();
                          });
                        }
                      }
                    }
                  }
                });
              });
            }

            const hasAnyData =
              hasEstimationData ||
              Object.keys(p.rows || {}).length > 0 ||
              Object.keys(p.pmoRows || {}).length > 0 ||
              Object.keys(p.actuals || {}).length > 0 ||
              Object.keys(p.forecast || {}).length > 0 ||
              Object.keys(p.skills || {}).length > 0 ||
              Object.keys(p.expenses || {}).length > 0;

            const errors: string[] = [];
            if (!p.code || p.code === "undefined") errors.push("Missing ID");
            if (!p.name) errors.push("Missing Name");
            const masterVertMatch = (masterConfig.verticals || []).find(
              (v) => v.toUpperCase() === (p.vertical || "").toUpperCase(),
            );
            if (p.vertical && !masterVertMatch)
              errors.push(`Invalid Vertical: ${p.vertical}`);
            else if (p.vertical) p.vertical = masterVertMatch;

            const isGenericCode = !p.code || p.code.toUpperCase() === "UMD-XXXX" || p.code.toUpperCase() === "TBD" || p.code.toUpperCase() === "NEW" || p.code.toUpperCase().includes("XXXX");

            let exists: ProjectData | undefined = undefined;

            // 1. Primary match: System-ID / UUID (if provided in row A)
            if (uuid) {
              exists = existingProjects.find((mp) => mp.id === uuid);
            }

            // 2. Secondary match: Exact Code + Name + Vertical
            if (!exists && p.code && p.name) {
              exists = existingProjects.find(
                (mp) =>
                  (mp.code || "").toUpperCase() === (p.code || "").toUpperCase() &&
                  (mp.name || "").toLowerCase().trim() === (p.name || "").toLowerCase().trim() &&
                  (!p.vertical || (mp.vertical || "").toLowerCase() === p.vertical.toLowerCase())
              );
            }

            // 3. Tertiary match: Code + Vertical (ONLY if code is NOT generic AND uniquely identifies 1 project)
            if (!exists && !isGenericCode && p.code) {
              const codeMatches = existingProjects.filter(
                (mp) =>
                  (mp.code || "").toUpperCase() === (p.code || "").toUpperCase() &&
                  (!p.vertical || (mp.vertical || "").toLowerCase() === p.vertical.toLowerCase())
              );
              if (codeMatches.length === 1) {
                exists = codeMatches[0];
              }
            }

            // 4. Quaternary match: Name + Vertical
            if (!exists && p.name) {
              exists = existingProjects.find(
                (mp) =>
                  (mp.name || "").toLowerCase().trim() === (p.name || "").toLowerCase().trim() &&
                  (!p.vertical || (mp.vertical || "").toLowerCase() === p.vertical.toLowerCase())
              );
            }

            if (exists) {
              p.id = exists.id;
            }
            let importStatus: "valid" | "update" | "error" = "valid";
            if (errors.length > 0) {
              importStatus = "error";
            } else if (exists) {
              const hasDataInContext =
                exists[targetKey] &&
                Object.keys(exists[targetKey] as object).length > 0;
              importStatus = hasDataInContext ? "update" : "valid";
            }

            acc.push({ ...p, importStatus, errors, hasEstimationData: hasAnyData });
            return acc;
          }, []);

        onProgress?.(100, "Import complete!");
        resolve({
          projects: projectsWithStatus,
          summary: {
            total: projectsWithStatus.length,
            valid: projectsWithStatus.filter((p) => p.importStatus === "valid")
              .length,
            updates: projectsWithStatus.filter(
              (p) => p.importStatus === "update",
            ).length,
            errors: projectsWithStatus.filter((p) => p.importStatus === "error")
              .length,
          },
        });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

/**
 * IMPORT LOGIC - RESOURCES
 */
export const processResourceImport = async (
  file: File,
  config: MasterConfigState,
  existingEmployees: Employee[],
  projects: ProjectData[],
) => {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet =
          workbook.getWorksheet("Employee List") ||
          workbook.getWorksheet("Identity Registry") ||
          workbook.worksheets[0];
        if (!worksheet)
          throw new Error(
            "No worksheet found in the uploaded Excel file.",
          );

        const headerRow = worksheet.getRow(1);
        const colMap: { [key: string]: number } = {};
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const val = (cell.text || String(cell.value || "")).trim().toLowerCase();
          if (val && !colMap[val]) colMap[val] = colNumber;
        });

        console.log("Excel Headers Mapped:", colMap);

        const findCol = (keys: string[]) => {
          // 1. Exact Match
          for (const key of keys) {
            const k = key.toLowerCase();
            if (colMap[k]) return colMap[k];
          }
          // 2. Fuzzy Substring Match (Case-Insensitive)
          const headerEntries = Object.entries(colMap);
          for (const key of keys) {
            const k = key.toLowerCase();
            if (k.length < 3) continue; // Avoid too short keys for fuzzy
            const found = headerEntries.find(([header]) => 
                header.includes(k) || k.includes(header)
            );
            if (found) return found[1];
          }
          return -1;
        };

        const indices = {
            systemId: findCol(["uuid", "system id", "id"]),
            empId: findCol(["emp id", "employee id", "employee code", "staff id", "resource id", "id"]),
            name: findCol(["name", "employee name", "full name", "resource name"]),
            email: findCol(["email", "email id", "email address", "mail", "email-id"]),
            status: findCol(["status", "active/inactive", "employee status"]),
            vertical: findCol(["vertical", "business unit", "dept", "department", "bu", "unit"]),
            functionalTeam: findCol(["func. team", "functional team", "team", "function", "dept"]),
            category: findCol(["category", "employee category", "manpower category"]),
            band: findCol(["band", "level", "grade"]),
            location: findCol(["location", "city", "operating location", "work location", "office"]),
            skillL2: findCol(["skill level 2", "skill l2", "skill (l2)", "skill(l2)", "l2 skill"]),
            prmId: findCol(["prm", "prm id", "pr manager id", "pr manager", "reporting manager", "primary reporting manager", "manager", "prm name", "primary manager", "project manager", "line manager", "rm", "reporting lead", "primary rm", "reporting to", "reports to", "rp manager", "pm name", "reporting mgr", "reporting lead"]),
            frmId: findCol(["frm", "frm id", "fr manager id", "fr manager", "functional manager", "functional reporting manager", "frm name", "functional lead", "direct manager", "functional rm", "fm name", "functional mgr"]),
            family: findCol(["product family", "family", "business family", "product", "vertical family"]),
            project: findCol(["project", "allocated project", "current project", "project name", "allocation"]),
            gender: findCol(["gender", "sex", "gender category", "m/f"]),
            dob: findCol(["dob", "date of birth", "birth date", "birth-date", "dob date"]),
            doj: findCol(["doj", "date of joining", "joining date", "date of join", "dojoin", "joining-date", "doj-date", "date of entry", "joining", "hire date", "date of hire", "hired on"]),
            remarks: findCol(["remarks", "comments", "internal remarks", "employee notes"]),
            skillL1: findCol(["ag role hr master 2", "skill l1", "skill", "skill category (l1)", "l1 skill", "skills", "skill category", "primary skill"])
        };

        console.log("Resource Import Indices Identified:", indices);
        Object.entries(indices).forEach(([key, val]) => {
           if (val !== -1) {
             console.log(`Mapping ${key} to Column ${val} (${worksheet.getRow(1).getCell(val).text})`);
           }
        });

        const resourcesWithStatus: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1 || !row) return;

          // Check if row has any content
          let hasContent = false;
          row.eachCell((cell) => { if (cell.value) hasContent = true; });
          if (!hasContent) return;

          const getValue = (idx: number) => {
            if (idx === -1) return null;
            const cell = row.getCell(idx);
            const val = cell.value;
            if (val !== null && val !== undefined) return val;
            return cell.text?.trim() || null;
          };

          const getString = (idx: number) => {
            if (idx === -1) return "";
            const cell = row.getCell(idx);
            const val = cell.value;
            if (val === null || val === undefined) return cell.text?.trim() || "";
            
            if (typeof val === 'object') {
              // Handle Hyperlinks
              if ((val as any).text !== undefined) return String((val as any).text).trim();
              if ((val as any).hyperlink !== undefined) {
                 return String((val as any).hyperlink).trim();
              }
              // Handle Formulas
              if ((val as any).result !== undefined) {
                 const res = (val as any).result;
                 if (res && typeof res === 'object') {
                    if (res.text) return String(res.text).trim();
                    if (res.richText) return (res as any).richText.map((rt: any) => rt.text || "").join("").trim();
                    return cell.text?.trim() || "";
                 }
                 return String(res).trim();
              }
              // Handle Rich Text
              if (Array.isArray((val as any).richText)) {
                return (val as any).richText.map((rt: any) => rt.text || "").join("").trim();
              }
              // Generic fallback for other objects
              const sVal = String(val);
              if (sVal === "[object Object]" || sVal.startsWith("{")) return cell.text?.trim() || "";
              return sVal.trim();
            }
            return String(val).trim();
          };

          const systemId = getString(indices.systemId);
          const empId = getString(indices.empId);
          const name = getString(indices.name);
          const email = getString(indices.email);
          const status = getString(indices.status);
          const vertical = getString(indices.vertical);
          const functionalTeam = getString(indices.functionalTeam);
          const category = getString(indices.category);
          const band = getString(indices.band);
          const location = getString(indices.location);
          const skillL1 = getString(indices.skillL1);
          const skillLevel2 = getString(indices.skillL2);
          const prmId = getString(indices.prmId);
          const frmId = getString(indices.frmId);
          const family = getString(indices.family);
          const projectStr = getString(indices.project);
          
          const rawGender = getValue(indices.gender);
          const rawDob = getValue(indices.dob);
          const rawDoj = getValue(indices.doj);
          const remarks = getString(indices.remarks);

          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const parsedDob = parseExcelDate(rawDob, monthNames);
          const parsedDoj = parseExcelDate(rawDoj, monthNames);
          
          if (rawDob) console.log(`Import Row ${rowNumber}: Emp ${empId} DOB ${rawDob} -> ${parsedDob}`);
          if (rawDoj) console.log(`Import Row ${rowNumber}: Emp ${empId} DOJ ${rawDoj} -> ${parsedDoj}`);
          
          const genderStr = String(rawGender || "").toLowerCase().trim();
          let finalGender: "Male" | "Female" | "Other" | undefined = undefined;
          if (genderStr === "male" || genderStr === "m") finalGender = "Male";
          else if (genderStr === "female" || genderStr === "f") finalGender = "Female";
          else if (genderStr === "other" || genderStr === "o") finalGender = "Other";
          else if (genderStr.startsWith("m") && !genderStr.startsWith("f")) finalGender = "Male";
          else if (genderStr.startsWith("f")) finalGender = "Female";
          else if (genderStr.includes("female")) finalGender = "Female";
          else if (genderStr.includes("male")) finalGender = "Male";

          const errors: string[] = [];
          if (!empId) {
             errors.push(`Missing Emp ID (Header indexed at ${indices.empId})`);
             console.warn(`Row ${rowNumber} missing Emp ID. Indices:`, indices);
          }
          if (!name) errors.push("Missing Name");

          const cleanStatus = (status || "").trim().toLowerCase();
          const finalStatus = cleanStatus.includes("inactive") ? "Inactive" : "Active";

          const projectCode = projectStr?.split(":")[0]?.trim();
          const targetProject = projectCode
            ? (projects || []).find((p) => p.code === projectCode)
            : null;
          if (projectCode && !targetProject)
            errors.push(`Project not found: ${projectCode}`);

          const emp: Partial<Employee> = {
            id: systemId || generateUUID(),
            empId: empId || "",
            name: name || "",
            email: email || "",
            gender: finalGender,
            dateOfBirth: parsedDob ? parsedDob.toISOString().split('T')[0] : "",
            dateOfJoining: parsedDoj ? parsedDoj.toISOString().split('T')[0] : "",
            status: finalStatus,
            vertical: vertical || config?.verticals?.[0] || "NA",
            functionalTeam: functionalTeam || "NA",
            category:
              category ||
              config?.employeeCategories?.[0] ||
              "NA",
            band: band || config?.bands?.[0] || "NA",
            location:
              location || config?.locations?.[0] || "NA",
            skill:
              skillL1 ||
              RESOURCE_SKILLS?.[0] ||
              "NA",
            skillLevel2:
              skillLevel2 ||
              config?.skillLevelsL2?.[0] ||
              "NA",
            prmId: prmId || "",
            frmId: frmId || "",
            productFamily:
              family ||
              config?.productFamilies?.[0] ||
              "NA",
            allocatedProjectId: targetProject?.id || "",
            remarks: remarks || "",
          };

          // Fix: Use correct variable name 'ex' instead of 'x' to reference the predicate argument.
          const exists = systemId
            ? (existingEmployees || []).find((ex) => ex.id === systemId)
            : (existingEmployees || []).find((ex) => ex.empId === empId);
          if (exists && !systemId) emp.id = exists.id;

          resourcesWithStatus.push({
            ...emp,
            importStatus:
              errors.length > 0 ? "error" : exists ? "update" : "valid",
            errors,
          });
        });
        

        resolve({
          resources: resourcesWithStatus,
          summary: {
            total: resourcesWithStatus.length,
            valid: resourcesWithStatus.filter((r) => r.importStatus === "valid")
              .length,
            updates: resourcesWithStatus.filter(
              (r) => r.importStatus === "update",
            ).length,
            errors: resourcesWithStatus.filter(
              (r) => r.importStatus === "error",
            ).length,
          },
        });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
