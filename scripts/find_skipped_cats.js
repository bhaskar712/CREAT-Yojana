import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const EXPENSE_CATEGORIES = [
  "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others", "Contracted Employee", "Contracted Employee Expense", "Operational Expenses (Cr)"
];

const categorySums = {};
let totalExp = 0;

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const recType = String(r[22] || "").trim().toLowerCase();
  if (recType !== "expense") continue;

  const code = String(r[0] || "").trim().toUpperCase();
  const bucket = String(r[21] || "Others").trim();
  const amt = parseFloat(r[23]) || 0;

  categorySums[bucket] = (categorySums[bucket] || 0) + amt;
  totalExp += amt;
}

console.log('--- EXCEL EXPENSE BUCKETS ---');
Object.keys(categorySums).sort().forEach(cat => {
  const inList = EXPENSE_CATEGORIES.includes(cat);
  console.log(`${cat.padEnd(30)}: ₹ ${categorySums[cat].toLocaleString('en-IN').padStart(15)} (${(categorySums[cat]/1e7).toFixed(7)} Cr) [In List: ${inList}]`);
});

console.log('\nTotal Expense Sum:', totalExp.toLocaleString('en-IN'), `(${(totalExp/1e7).toFixed(7)} Cr)`);

const skippedSum = Object.keys(categorySums)
  .filter(cat => !EXPENSE_CATEGORIES.includes(cat))
  .reduce((acc, cat) => acc + categorySums[cat], 0);

console.log('Total Sum of Skipped Categories:', skippedSum.toLocaleString('en-IN'), `(${(skippedSum/1e7).toFixed(7)} Cr)`);
