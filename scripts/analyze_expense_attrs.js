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

// Header row is row 1
const headerRow = sheetRows[1];

let tbcStats = {};
let verticalStats = {};
let categoryStats = {};
let statusStats = {};
let totalExp = 0;

let expenseByTBC = {};
let expenseByStatus = {};
let expenseByCategory = {};
let expenseByVertical = {};
let expenseByProject = {};

for (let i = 2; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;
  const recType = String(row[22] || '').trim().toLowerCase();
  if (recType !== 'expense') continue;

  const amt = parseVal(row[23]);
  const code = String(row[0] || '').trim().toUpperCase();
  const name = String(row[1] || '').trim();
  const pFamily = String(row[14] || '').trim();
  const creatType = String(row[15] || '').trim();
  const vertical = String(row[16] || '').trim();
  const pStatus = String(row[18] || '').trim();
  const bucket = String(row[21] || 'Others').trim();

  totalExp += amt;

  expenseByStatus[pStatus] = (expenseByStatus[pStatus] || 0) + amt;
  expenseByVertical[vertical] = (expenseByVertical[vertical] || 0) + amt;
  expenseByCategory[creatType] = (expenseByCategory[creatType] || 0) + amt;
}

console.log('Total Expense:', totalExp, 'INR ->', (totalExp / 1e7).toFixed(7), 'Cr');
console.log('\n--- EXPENSE BY PROJECT STATUS (Col S = idx 18) ---');
Object.keys(expenseByStatus).forEach(k => {
  console.log(`"${k}": ₹ ${expenseByStatus[k].toLocaleString('en-IN')} (${(expenseByStatus[k] / 1e7).toFixed(7)} Cr)`);
});

console.log('\n--- EXPENSE BY CREAT TYPE (Col P = idx 15) ---');
Object.keys(expenseByCategory).forEach(k => {
  console.log(`"${k}": ₹ ${expenseByCategory[k].toLocaleString('en-IN')} (${(expenseByCategory[k] / 1e7).toFixed(7)} Cr)`);
});

console.log('\n--- EXPENSE BY VERTICAL (Col Q = idx 16) ---');
Object.keys(expenseByVertical).forEach(k => {
  console.log(`"${k}": ₹ ${expenseByVertical[k].toLocaleString('en-IN')} (${(expenseByVertical[k] / 1e7).toFixed(7)} Cr)`);
});
