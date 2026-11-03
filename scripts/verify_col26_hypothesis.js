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

let sumCol23 = 0;
let sumCol26 = 0;

for (let i = 2; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;
  const recType = String(row[22] || '').trim().toLowerCase();
  if (recType === 'expense') {
    sumCol23 += parseVal(row[23]);
    sumCol26 += parseVal(row[26]);
  }
}

console.log('Expense rows sum Col 23 (Expense Amount):', sumCol23, 'INR ->', (sumCol23 / 1e7).toFixed(2), 'Crs');
console.log('Expense rows sum Col 26 (Total Cost):', sumCol26, 'INR ->', (sumCol26 / 1e7).toFixed(2), 'Crs');
