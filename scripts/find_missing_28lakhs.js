import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const parseVal = (val) => {
  if (typeof val === "number") return val;
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/[^0-9.%-]/g, "");
  if (clean.includes("%")) return (parseFloat(clean.replace("%", "")) || 0) / 100;
  return parseFloat(clean || "0") || 0;
};

const projectExpenses = {};
const projectNames = {};

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;
  const recType = String(row[22] || '').trim().toLowerCase();
  if (recType !== 'expense') continue;

  const code = String(row[0] || '').trim().toUpperCase();
  const name = String(row[1] || '').trim();
  const bucket = String(row[21] || 'Others').trim();
  const amt = parseVal(row[23]);

  projectNames[code] = name;
  if (!projectExpenses[code]) projectExpenses[code] = { total: 0, byBucket: {}, name };
  projectExpenses[code].total += amt;
  projectExpenses[code].byBucket[bucket] = (projectExpenses[code].byBucket[bucket] || 0) + amt;
}

console.log('--- PROJECTS WITH EXPENSES AND "HOLIDAY" OR "LEAVE" IN NAME ---');
let holidayLeaveExpenseSum = 0;
Object.keys(projectExpenses).forEach(code => {
  const p = projectExpenses[code];
  const nameLower = (p.name || '').toLowerCase();
  if (nameLower.includes('holiday') || nameLower.includes('leave')) {
    console.log(`Project: ${code} - "${p.name}": ₹ ${p.total.toLocaleString('en-IN')} (${(p.total / 1e7).toFixed(7)} Cr)`);
    console.log('  Buckets:', p.byBucket);
    holidayLeaveExpenseSum += p.total;
  }
});

console.log(`Total Holiday/Leave Expenses: ₹ ${holidayLeaveExpenseSum.toLocaleString('en-IN')} (${(holidayLeaveExpenseSum / 1e7).toFixed(7)} Cr)`);

console.log('\n--- 25.2018603 - 24.9200000 = 0.2818603 Cr ---');
console.log(`Is holidayLeaveExpenseSum matching the difference?: ${holidayLeaveExpenseSum} INR -> ${(holidayLeaveExpenseSum / 1e7).toFixed(7)} Cr`);
