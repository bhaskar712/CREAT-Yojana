import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

let monthlySumsColX = {};
let monthlySumsByBucket = {};

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row || !Array.isArray(row)) continue;

  const dateVal = row[6]; // Col G
  if (dateVal === undefined || dateVal === null || dateVal === '') continue;

  let date = null;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else if (typeof dateVal === 'number') {
    date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  } else {
    const dateStr = String(dateVal).trim();
    const parts = dateStr.toLowerCase().split(/[-/\s.]/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      let m = -1, y = -1;
      for (let j = 0; j < parts.length; j++) {
        const foundMonth = monthNames.findIndex(name => parts[j].startsWith(name));
        if (foundMonth !== -1) {
          m = foundMonth;
          const otherIdx = j === 0 ? 1 : 0;
          y = parseInt(parts[otherIdx]);
          break;
        }
      }
      if (m !== -1 && !isNaN(y)) {
        if (y < 100) y += 2000;
        date = new Date(Date.UTC(y, m, 1));
      }
    }
    if (!date || isNaN(date.getTime())) date = new Date(dateStr);
  }

  if (!date || isNaN(date.getTime())) continue;

  const utcDate = new Date(date.getTime() + 43200000);
  const month = utcDate.getUTCMonth();
  const year = utcDate.getUTCFullYear();
  const monthNamesLong = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthStr = `${monthNamesLong[month]}-${year.toString().slice(-2)}`;

  const bucket = String(row[21] || '').trim(); // Col V (Expense Bucket)
  const valRaw = row[23]; // Col X (Amount)
  let val = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw || '0').replace(/[^0-9.%-]/g, '')) || 0;

  monthlySumsColX[monthStr] = (monthlySumsColX[monthStr] || 0) + val;

  if (!monthlySumsByBucket[bucket]) monthlySumsByBucket[bucket] = {};
  monthlySumsByBucket[bucket][monthStr] = (monthlySumsByBucket[bucket][monthStr] || 0) + val;
}

console.log('\n--- MONTHLY SUMS IN RAW EXCEL (COL X) ---');
let grandTotal = 0;
Object.keys(monthlySumsColX).sort().forEach(m => {
  const sumInr = monthlySumsColX[m];
  const sumCr = (sumInr / 1e7).toFixed(2);
  grandTotal += sumInr;
  console.log(`${m}: ₹ ${sumInr.toLocaleString('en-IN')} (${sumCr} Cr)`);
});
console.log(`GRAND TOTAL: ₹ ${grandTotal.toLocaleString('en-IN')} (${(grandTotal / 1e7).toFixed(2)} Cr)`);

console.log('\n--- BREAKDOWN BY BUCKET AND MONTH (IN LAKHS / CRS) ---');
Object.keys(monthlySumsByBucket).sort().forEach(b => {
  console.log(`\nBucket: "${b}"`);
  let bucketTotal = 0;
  Object.keys(monthlySumsByBucket[b]).sort().forEach(m => {
    const val = monthlySumsByBucket[b][m];
    bucketTotal += val;
    console.log(`  ${m}: ${(val / 1e7).toFixed(2)} Cr (₹ ${val.toFixed(2)})`);
  });
  console.log(`  TOTAL: ${(bucketTotal / 1e7).toFixed(2)} Cr`);
});
