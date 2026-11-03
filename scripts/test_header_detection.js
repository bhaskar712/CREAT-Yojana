import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRow = sheetRows[0] || [];

let colIndices = {
  code: -1,
  name: -1,
  month: -1,
  hours: -1,
  amount: -1,
  bucket: -1,
  type: -1,
  skill: -1,
  amountFound: false,
};

headerRow.forEach((cell, idx) => {
  const s = String(cell || '').toLowerCase().trim();
  if (s.includes('project code') || s === 'code' || s === 'id' || s === 'project_code') colIndices.code = idx;
  if (s.includes('project name') || s === 'name' || s === 'project_name') colIndices.name = idx;
  if (s === 'month' || s === 'month-year' || s === 'month year') colIndices.month = idx;
  if (s === 'hours' || s === 'working hours' || s === 'billable hours' || s === 'hrs') colIndices.hours = idx;
  if (s === 'amount' || s === 'value' || s === 'cost' || s === 'total' || s.includes('expense amount') || s.includes('total expense') || s === 'actuals' || s.includes('total cost') || s.includes('net cost') || s.includes('manpower cost')) {
    if (s.includes('total expense') || s.includes('total cost') || s.includes('net cost') || !colIndices.amountFound) {
      colIndices.amount = idx;
      colIndices.amountFound = true;
    }
  }
  if (s.includes('expense bucket') || s === 'bucket' || s === 'category') colIndices.bucket = idx;
  if (s.includes('record type') || s === 'type' || s === 'record_type') colIndices.type = idx;
});

console.log('Detected Column Indices from header row 0:');
console.log(colIndices);
console.log(`Col ${colIndices.amount} (${XLSX.utils.encode_col(colIndices.amount)}): "${headerRow[colIndices.amount]}"`);

// Calculate sum using detected colIndices.amount
let detectedSum = 0;
for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;
  const valRaw = row[colIndices.amount];
  let val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw || '0').replace(/[^0-9.%-]/g, '')) || 0;
  detectedSum += val;
}

console.log('Sum using detected Col', colIndices.amount, ':', detectedSum, 'INR ->', (detectedSum / 1e7).toFixed(4), 'Crs');

// Also check what Col 23 (X) sum is vs Col 24 (Y) vs Col 25 (Z)
[22, 23, 24, 25, 26, 27].forEach(cIdx => {
  let s = 0;
  for (let i = 1; i < sheetRows.length; i++) {
    const valRaw = sheetRows[i]?.[cIdx];
    let val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw || '0').replace(/[^0-9.%-]/g, '')) || 0;
    s += val;
  }
  console.log(`Col ${cIdx} (${XLSX.utils.encode_col(cIdx)}) "${headerRow[cIdx]}": ${s} INR -> ${(s / 1e7).toFixed(4)} Crs`);
});
