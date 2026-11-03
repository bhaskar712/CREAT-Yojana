import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer', dense: true });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthNamesLong = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const parseVal = (val) => {
  if (typeof val === "number") return val;
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/[^0-9.%-]/g, "");
  if (clean.includes("%")) return (parseFloat(clean.replace("%", "")) || 0) / 100;
  return parseFloat(clean || "0") || 0;
};

let totalColX = 0;
let totalExpenseColX = 0;
let totalTimelogColX = 0;
let byMonth = {};
let noDateSum = 0;
let invalidDateSum = 0;
let unmappedBucketSum = 0;
let byBucket = {};
let byProject = {};
let nonMatchingFySum = 0;

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row) continue;
  
  const recType = String(row[22] || '').trim().toLowerCase();
  const val = parseVal(row[23]); // Col X
  totalColX += val;

  if (recType === 'expense') {
    totalExpenseColX += val;
    
    // Check Date (Col G = idx 6)
    const dateVal = row[6];
    let date = null;
    if (dateVal === undefined || dateVal === null || dateVal === '') {
      noDateSum += val;
      continue;
    }

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

    if (!date || isNaN(date.getTime())) {
      invalidDateSum += val;
      continue;
    }

    const utcDate = new Date(date.getTime() + 43200000);
    const month = utcDate.getUTCMonth();
    const year = utcDate.getUTCFullYear();
    const monthStr = `${monthNamesLong[month]}-${year.toString().slice(-2)}`;

    byMonth[monthStr] = (byMonth[monthStr] || 0) + val;

    const b = String(row[21] || 'Others').trim();
    byBucket[b] = (byBucket[b] || 0) + val;
  } else {
    totalTimelogColX += val;
  }
}

console.log('=== FAST INSPECTION RESULTS ===');
console.log('Total Col X:', totalColX, '(', (totalColX / 1e7).toFixed(7), 'Cr)');
console.log('Total Expense Col X:', totalExpenseColX, '(', (totalExpenseColX / 1e7).toFixed(7), 'Cr)');
console.log('Total Timelog Col X:', totalTimelogColX);
console.log('No Date sum:', noDateSum, '(', (noDateSum / 1e7).toFixed(7), 'Cr)');
console.log('Invalid Date sum:', invalidDateSum);
console.log('\n--- BY MONTH (EXPENSES) ---');
let monthSumTotal = 0;
Object.keys(byMonth).sort().forEach(m => {
  monthSumTotal += byMonth[m];
  console.log(`${m}: ₹ ${byMonth[m].toFixed(2)} (${(byMonth[m] / 1e7).toFixed(7)} Cr)`);
});
console.log('Total across all months:', monthSumTotal, '(', (monthSumTotal / 1e7).toFixed(7), 'Cr)');

console.log('\n--- BY BUCKET (RAW COL V) ---');
Object.keys(byBucket).sort().forEach(b => {
  console.log(`"${b}": ₹ ${byBucket[b].toFixed(2)} (${(byBucket[b] / 1e7).toFixed(7)} Cr)`);
});
