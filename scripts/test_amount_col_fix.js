import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRow = sheetRows[1] || [];

let colIndices = {
  code: -1,
  name: -1,
  month: -1,
  hours: -1,
  amount: -1,
  expenseAmount: -1,
  manpowerCost: -1,
  totalExpense: -1,
  totalCost: -1,
  bucket: -1,
  type: -1,
  skill: -1,
};

headerRow.forEach((cell, idx) => {
  const s = String(cell || '').toLowerCase().trim();
  if (s === 'expense amount') colIndices.expenseAmount = idx;
  if (s === 'manpower cost') colIndices.manpowerCost = idx;
  if (s === 'total expense') colIndices.totalExpense = idx;
  if (s === 'total cost') colIndices.totalCost = idx;
  if (s.includes('project code') || s === 'code') colIndices.code = idx;
  if (s === 'month') colIndices.month = idx;
  if (s.includes('record type') || s === 'type') colIndices.type = idx;
  if (s.includes('expense bucket') || s === 'bucket') colIndices.bucket = idx;
});

console.log('Specific Header Indices:', colIndices);

let sumExpenseAmountCol = 0;
let sumTotalExpenseCol = 0;
let sumTotalCostCol = 0;

for (let i = 2; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;

  const recType = String(row[colIndices.type] || '').trim().toLowerCase();
  if (recType === 'expense') {
    const expAmt = parseFloat(row[colIndices.expenseAmount]) || 0;
    const totExp = parseFloat(row[colIndices.totalExpense]) || 0;
    const totCost = parseFloat(row[colIndices.totalCost]) || 0;

    sumExpenseAmountCol += expAmt;
    sumTotalExpenseCol += totExp;
    sumTotalCostCol += totCost;
  }
}

console.log('Expense Amount Col (23):', sumExpenseAmountCol, 'INR ->', (sumExpenseAmountCol / 1e7).toFixed(2), 'Crs');
console.log('Total Expense Col (25):', sumTotalExpenseCol, 'INR ->', (sumTotalExpenseCol / 1e7).toFixed(2), 'Crs');
console.log('Total Cost Col (26):', sumTotalCostCol, 'INR ->', (sumTotalCostCol / 1e7).toFixed(2), 'Crs');
