import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < 5; r++) {
  console.log(`\n--- ROW ${r} ---`);
  const row = sheetRows[r] || [];
  row.forEach((c, idx) => {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      console.log(`  Col ${idx} (${XLSX.utils.encode_col(idx)}): "${c}"`);
    }
  });
}
