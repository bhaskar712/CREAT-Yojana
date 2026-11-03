import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const data = ws['!data'];

console.log('Total dense rows:', data ? data.length : 0);

if (data && data[0]) {
  console.log('Row 0 cell count:', data[0].length);
  data[0].forEach((c, idx) => {
    const val = c ? (c.v !== undefined ? c.v : c.w) : '';
    console.log(`Col ${idx} (${XLSX.utils.encode_col(idx)}): "${val}"`);
  });
}
