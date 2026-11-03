import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function getAbsoluteMonthIndex(monthStr) {
  const parts = monthStr.split('-');
  if (parts.length !== 2) return -1;
  const mName = parts[0].toLowerCase();
  const mIdx = monthNames.findIndex(m => mName.startsWith(m));
  if (mIdx === -1) return -1;
  let yr = parseInt(parts[1]);
  if (yr < 100) yr += 2000;
  return (yr - 2019) * 12 + mIdx;
}

const norm = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

const EXPENSE_CATEGORIES = [
  "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others", "Contracted Employee Expense"
];

let colIndices = {
  code: 0,
  name: 1,
  month: 6,
  hours: 11,
  amount: 23, // Expense Amount (Col 23 / Column X)
  bucket: 21,
  type: 22,
  skill: 31,
};

let flatDataMap = {};

for (let i = 2; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row || !Array.isArray(row) || row.length < 2) continue;

  let projectCode = String(row[colIndices.code] || "").trim().toUpperCase();
  if (!projectCode || projectCode === "PROJECT CODE" || projectCode.includes("TIMESHEET")) continue;

  const dateVal = row[colIndices.month];
  if (dateVal === undefined || dateVal === null || dateVal === "") continue;

  let date = null;
  if (dateVal instanceof Date) date = dateVal;
  else if (typeof dateVal === "number") date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  else {
    const dateStr = String(dateVal).trim();
    const parts = dateStr.toLowerCase().split(/[-/\s.]/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      let m = -1, y = -1;
      for (let j = 0; j < parts.length; j++) {
        const foundMonth = monthNames.findIndex(name => parts[j].startsWith(name));
        if (foundMonth !== -1) {
          m = foundMonth;
          const otherIdx = j === 0 ? 1 : 0;
          y = parseInt(parts[otherIdx]);
          break;
        }
      }
      if (m !== -1 && !isNaN(y)) {
        if (y < 100) y += 2000;
        date = new Date(Date.UTC(y, m, 1));
      }
    }
    if (!date || isNaN(date.getTime())) date = new Date(dateStr);
  }

  if (!date || isNaN(date.getTime())) continue;

  const utcDate = new Date(date.getTime() + 43200000);
  const month = utcDate.getUTCMonth();
  const year = utcDate.getUTCFullYear();
  const monthNamesLong = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthStr = `${monthNamesLong[month]}-${year.toString().slice(-2)}`;
  const monthIdx = getAbsoluteMonthIndex(monthStr);

  if (monthIdx < 0 || monthIdx >= 120) continue;

  const targetKey = "actuals";

  if (!flatDataMap[projectCode]) {
    flatDataMap[projectCode] = { actuals: {} };
  }
  const pData = flatDataMap[projectCode];
  const recordType = String(row[colIndices.type] || "").trim().toLowerCase();
  const rawSkill = String(row[colIndices.skill] || "").trim();
  const expBucketRaw = String(row[colIndices.bucket] || "").trim();

  const parseVal = (val) => {
    if (typeof val === "number") return val;
    if (val === undefined || val === null) return 0;
    const clean = String(val).replace(/[^0-9.%-]/g, "");
    if (clean.includes("%")) return (parseFloat(clean.replace("%", "")) || 0) / 100;
    return parseFloat(clean || "0") || 0;
  };

  const hours = parseVal(row[colIndices.hours]);
  const amount = parseVal(row[colIndices.amount]);

  const isExpense = recordType === "expense" || recordType === "exp" ||
    (!recordType.includes("timelog") && !recordType.includes("time") && (amount !== 0) &&
    (hours === 0 || expBucketRaw !== "" || EXPENSE_CATEGORIES.some(c => norm(c) === norm(rawSkill)) || EXPENSE_CATEGORIES.some(c => norm(c) === norm(expBucketRaw))));

  if (isExpense) {
    const bucketSource = rawSkill || expBucketRaw || "Others";
    let bucket = "Others";
    const normalizedSource = bucketSource.trim().toLowerCase();
    if (normalizedSource.includes("travel")) bucket = "Travel";
    else if (normalizedSource.includes("material")) bucket = "Material";
    else if (normalizedSource.includes("consultant") || normalizedSource.includes("consultancy")) bucket = "Consultant"; // FIXED!
    else if (normalizedSource.includes("outsourcing") || normalizedSource === "contracted employee") bucket = "Contracted Employee";
    else if (normalizedSource.includes("hr")) bucket = "HR";
    else if (normalizedSource.includes("admin")) bucket = "Admin";
    else if (normalizedSource.includes("lab") && !normalizedSource.includes("engineer")) bucket = "Labs";
    else if (normalizedSource.includes("license")) bucket = "License";
    else {
      const eCat = EXPENSE_CATEGORIES.find(c => norm(c) === norm(bucketSource));
      bucket = eCat || bucketSource;
    }

    if (!pData[targetKey][bucket]) pData[targetKey][bucket] = new Array(120).fill(0);
    pData[targetKey][bucket][monthIdx] += amount;
  }
}

// Calculate total Operational Expenses for FY 26-27 across all projects
let fy2627TotalExpense = 0;
let monthlyExpenseTotals = new Array(12).fill(0);
let bucketTotals = {};

const fyStartIdx = (2026 - 2019) * 12 + 3; // Apr-26

Object.values(flatDataMap).forEach((pData) => {
  Object.entries(pData.actuals).forEach(([bucket, months]) => {
    if (bucket === "Contracted Employee") return; // Manpower MM
    if (!bucketTotals[bucket]) bucketTotals[bucket] = 0;

    for (let m = 0; m < 12; m++) {
      const idx = fyStartIdx + m;
      const val = months[idx] || 0;
      monthlyExpenseTotals[m] += val;
      bucketTotals[bucket] += val;
      fy2627TotalExpense += val;
    }
  });
});

console.log('--- FIXED SIMULATED PMO ACTUALS EXPENSE TOTAL FOR FY 26-27 ---');
console.log('Total FY 26-27 Operational Expense:', fy2627TotalExpense, 'INR ->', (fy2627TotalExpense / 1e7).toFixed(2), 'Crs');

const mNames = ["Apr-26","May-26","Jun-26","Jul-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26","Jan-27","Feb-27","Mar-27"];
mNames.forEach((m, idx) => {
  const val = monthlyExpenseTotals[idx];
  console.log(`  ${m}: ${(val / 1e7).toFixed(2)} Cr (₹ ${val.toLocaleString('en-IN')})`);
});

console.log('\nBucket Totals in FY 26-27:');
Object.keys(bucketTotals).sort().forEach(b => {
  const val = bucketTotals[b];
  console.log(`  ${b}: ${(val / 1e7).toFixed(2)} Cr (₹ ${val.toLocaleString('en-IN')})`);
});
