import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('sheetRows length:', sheetRows.length);

// Let's check headerRowIdx logic in exportService.ts:
const headerRowIdx = sheetRows.findIndex(row =>
  Array.isArray(row) && row.some(cell => {
    const s = String(cell || '').toLowerCase();
    return s.includes('project code') || s.includes('project name') || s.includes('record type') || s.includes('role hr master 2') || s.includes('functional unit') || s === 'month' || s === 'hours' || s === 'amount';
  })
);

console.log('headerRowIdx:', headerRowIdx);

if (headerRowIdx !== -1) {
  const headerRow = sheetRows[headerRowIdx] || [];
  console.log('Header Row:', headerRow);
}
