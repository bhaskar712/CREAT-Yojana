import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

let totalImportedAmount = 0;
let skippedNoCodeCount = 0;
let sumByRecordType = {};
let sumByCode = {};

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row || !Array.isArray(row)) continue;

  const projectCode = String(row[0] || '').trim().toUpperCase();
  const recType = String(row[22] || '').trim();
  const valRaw = row[23];
  let amount = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw || '0').replace(/[^0-9.%-]/g, '')) || 0;

  if (!projectCode || projectCode === 'PROJECT CODE') {
    skippedNoCodeCount++;
    continue;
  }

  totalImportedAmount += amount;
  sumByRecordType[recType] = (sumByRecordType[recType] || 0) + amount;
}

console.log('Total Imported:', totalImportedAmount, 'INR ->', (totalImportedAmount / 1e7).toFixed(4), 'Crs');
console.log('Skipped No Code:', skippedNoCodeCount);
console.log('Sums by Record Type:', sumByRecordType);
