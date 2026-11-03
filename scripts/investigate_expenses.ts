
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

// Check all sheets
wb.SheetNames.forEach((sName, sIdx) => {
  const ws = wb.Sheets[sName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  console.log(`Sheet [${sIdx}] "${sName}": ${rows.length} rows`);
});

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

const headerRow = sheetRows[0] || [];
console.log('Headers count:', headerRow.length);
headerRow.forEach((h, idx) => console.log(`Col ${idx} (${XLSX.utils.encode_col(idx)}): ${h}`));

let sumExpenseColX = 0;
let countExpenseRows = 0;
let sumAllColX = 0;
let skippedNoDate = 0;
let skippedNoCode = 0;
let skippedMonthOutOfRange = 0;
let sumByRecordType: Record<string, number> = {};

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row || !Array.isArray(row)) continue;

  const recType = String(row[22] || '').trim(); // Col W
  const valRaw = row[23]; // Col X
  let val = 0;
  if (typeof valRaw === 'number') val = valRaw;
  else if (valRaw) {
    const clean = String(valRaw).replace(/[^0-9.%-]/g, '');
    val = parseFloat(clean) || 0;
  }

  sumAllColX += val;
  sumByRecordType[recType] = (sumByRecordType[recType] || 0) + val;

  if (recType.toLowerCase() === 'expense') {
    sumExpenseColX += val;
    countExpenseRows++;
  }
}

console.log('\n--- EXCEL SUMMARY ---');
console.log('Total sum of all rows Col X:', sumAllColX, 'INR (', (sumAllColX / 1e7).toFixed(4), 'Crs )');
console.log('Total Expense rows count:', countExpenseRows);
console.log('Total Expense sum Col X:', sumExpenseColX, 'INR (', (sumExpenseColX / 1e7).toFixed(4), 'Crs )');
console.log('Sums by Record Type (Col W):', sumByRecordType);

