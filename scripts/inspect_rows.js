import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const data = ws['!data'];

console.log('--- FIRST 5 ROWS CELL VALUES ---');
for (let r = 0; r < 5; r++) {
  console.log(`\nROW ${r}:`);
  const row = data[r] || [];
  row.forEach((c, idx) => {
    const val = c ? (c.v !== undefined ? c.v : c.w) : '';
    if (val !== '') console.log(`  Col ${idx} (${XLSX.utils.encode_col(idx)}): "${val}"`);
  });
}
